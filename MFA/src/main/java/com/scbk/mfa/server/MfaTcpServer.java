package com.scbk.mfa.server;

import com.scbk.mfa.config.MfaConfig;
import com.scbk.mfa.protocol.MfaCodec;
import com.scbk.mfa.protocol.MfaMessage;
import com.scbk.mfa.protocol.MfaResponse;
import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketException;
import java.time.Duration;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Function;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * MFA TCP listener와 제한된 worker pool의 생명주기를 관리한다.
 *
 * <p>AS-IS의 무제한 대기 queue 대신 고정 worker 수와 bounded queue를 사용한다. 서버는 설정된 단일 주소에
 * bind하고, 종료 시 listener를 먼저 닫아 신규 요청을 막은 뒤 실행 중인 worker를 제한시간 동안 기다린다.
 */
public final class MfaTcpServer implements AutoCloseable {
  private static final Logger LOGGER = Logger.getLogger(MfaTcpServer.class.getName());

  private final MfaConfig.Server config;
  private final MfaCodec codec;
  private final Function<MfaMessage, MfaResponse> processor;
  private final ThreadPoolExecutor workers;
  private final AtomicLong acceptedConnections = new AtomicLong();
  private final AtomicLong completedRequests = new AtomicLong();
  private final AtomicLong failedRequests = new AtomicLong();
  private final AtomicLong rejectedRequests = new AtomicLong();

  private volatile boolean running;
  private volatile ServerSocket serverSocket;

  public MfaTcpServer(
      MfaConfig.Server config,
      MfaCodec codec,
      Function<MfaMessage, MfaResponse> processor) {
    this.config = config;
    this.codec = codec;
    this.processor = processor;
    this.workers =
        new ThreadPoolExecutor(
            config.workerThreads(),
            config.workerThreads(),
            0L,
            TimeUnit.MILLISECONDS,
            new ArrayBlockingQueue<>(config.queueCapacity()),
            new NamedThreadFactory(),
            // queue 포화 시 accept thread가 업무를 대신 수행하지 않고 명시적으로 거부한다.
            new ThreadPoolExecutor.AbortPolicy());
  }

  /**
   * listener를 열고 현재 thread에서 accept loop를 실행한다.
   *
   * <p>foreground blocking 메서드다. 이미 실행 중이면 중복 기동을 거부하고, bind/accept 실패는 호출자에게
   * 전달해 프로세스 실패로 처리한다.
   *
   * @throws IOException 주소 bind 또는 socket accept 실패
   */
  public void run() throws IOException {
    if (running) {
      throw new IllegalStateException("MFA TCP 서버가 이미 실행 중입니다");
    }
    ServerSocket opened = new ServerSocket();
    // 정상 재기동 직후 TIME_WAIT 때문에 bind가 불필요하게 실패하는 가능성을 줄인다.
    opened.setReuseAddress(true);
    opened.bind(
        new InetSocketAddress(InetAddress.getByName(config.bindAddress()), config.port()));
    serverSocket = opened;
    running = true;
    LOGGER.log(
        Level.INFO,
        "MFA TCP 서버 시작: {0}:{1}, charset={2}, workers={3}",
        new Object[] {
          config.bindAddress(), config.port(), config.charset().name(), config.workerThreads()
        });

    try {
      while (running) {
        Socket connection = opened.accept();
        acceptedConnections.incrementAndGet();
        configure(connection);
        submit(connection);
      }
    } catch (SocketException e) {
      if (running) {
        throw e;
      }
    } finally {
      running = false;
      closeServerSocket();
    }
  }

  /** 각 client socket에 read timeout과 단건 요청에 적합한 옵션을 적용한다. */
  private void configure(Socket socket) throws SocketException {
    socket.setSoTimeout(config.readTimeoutMillis());
    socket.setTcpNoDelay(true);
    socket.setKeepAlive(false);
  }

  /** 요청을 worker queue에 넣고, 자원 한도를 넘으면 E/500을 보낸 뒤 즉시 닫는다. */
  private void submit(Socket connection) {
    try {
      workers.execute(
          new MfaConnectionHandler(
              connection, codec, processor, completedRequests, failedRequests));
    } catch (RejectedExecutionException e) {
      rejectedRequests.incrementAndGet();
      sendBusyAndClose(connection);
      LOGGER.log(Level.WARNING, "MFA 작업 큐가 가득 차 연결을 거부했습니다");
    }
  }

  /** 과부하 응답 전송 여부와 관계없이 거부된 연결을 닫는다. */
  private void sendBusyAndClose(Socket connection) {
    try (connection) {
      connection.getOutputStream().write(codec.encode(MfaResponse.serverBusy()));
      connection.getOutputStream().flush();
    } catch (Exception ignored) {
      // 과부하 상태에서는 연결 종료를 우선한다.
    }
  }

  /**
   * accept loop와 worker pool을 idempotent하게 종료한다.
   *
   * <p>정상 대기시간 안에 worker가 끝나지 않으면 interrupt를 요청하고 현재 thread의 interrupt 상태를
   * 보존한다.
   */
  @Override
  public void close() {
    running = false;
    closeServerSocket();
    workers.shutdown();
    try {
      if (!workers.awaitTermination(config.shutdownTimeoutSeconds(), TimeUnit.SECONDS)) {
        workers.shutdownNow();
      }
    } catch (InterruptedException e) {
      workers.shutdownNow();
      Thread.currentThread().interrupt();
    }
    LOGGER.log(Level.INFO, "MFA TCP 서버 종료: {0}", metrics());
  }

  /** 열린 listener가 있으면 닫아 blocking accept를 깨운다. */
  private void closeServerSocket() {
    ServerSocket current = serverSocket;
    if (current != null && !current.isClosed()) {
      try {
        current.close();
      } catch (IOException e) {
        LOGGER.log(Level.WARNING, "MFA 서버 소켓 종료 중 오류가 발생했습니다", e);
      }
    }
  }

  public boolean isRunning() {
    return running;
  }

  public int localPort() {
    ServerSocket current = serverSocket;
    return current == null ? -1 : current.getLocalPort();
  }

  /** 운영 로그 및 테스트에서 사용할 현재 누적/순간 처리 지표 snapshot을 반환한다. */
  public ServerMetrics metrics() {
    return new ServerMetrics(
        acceptedConnections.get(),
        completedRequests.get(),
        failedRequests.get(),
        rejectedRequests.get(),
        workers.getActiveCount(),
        workers.getQueue().size());
  }

  /**
   * @param acceptedConnections accept한 누적 연결 수
   * @param completedRequests 정상 응답까지 전송한 누적 요청 수
   * @param failedRequests timeout, 프로토콜, IO/업무 처리 실패 누적 수
   * @param rejectedRequests worker queue 포화로 거부한 누적 수
   * @param activeWorkers 현재 실행 중인 worker 수
   * @param queuedRequests 현재 queue에서 기다리는 요청 수
   */
  public record ServerMetrics(
      long acceptedConnections,
      long completedRequests,
      long failedRequests,
      long rejectedRequests,
      int activeWorkers,
      int queuedRequests) {}

  /** worker 이름과 uncaught exception logger를 일관되게 적용한다. */
  private static final class NamedThreadFactory implements ThreadFactory {
    private final AtomicInteger sequence = new AtomicInteger();

    @Override
    public Thread newThread(Runnable task) {
      Thread thread = new Thread(task, "mfa-worker-" + sequence.incrementAndGet());
      // 실행 중인 요청을 JVM이 조용히 버리지 않도록 non-daemon thread로 둔다.
      thread.setDaemon(false);
      thread.setUncaughtExceptionHandler(
          (ignored, error) -> LOGGER.log(Level.SEVERE, "MFA worker가 비정상 종료됐습니다", error));
      return thread;
    }
  }
}
