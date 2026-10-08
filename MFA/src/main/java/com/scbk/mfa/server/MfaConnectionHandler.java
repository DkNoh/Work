package com.scbk.mfa.server;

import com.scbk.mfa.protocol.MfaCodec;
import com.scbk.mfa.protocol.MfaFrameReader;
import com.scbk.mfa.protocol.MfaMessage;
import com.scbk.mfa.protocol.MfaProtocolException;
import com.scbk.mfa.protocol.MfaResponse;
import java.io.IOException;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Function;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * 수락된 client socket 한 개에서 MFA 요청 한 건을 처리하는 worker.
 *
 * <p>한 연결당 요청 1건/응답 1건 원칙이며 성공·실패와 관계없이 finally에서 socket을 닫는다. 전문 원문과
 * 인증정보는 로그에 남기지 않고 원격 주소와 오류 종류만 기록한다.
 */
final class MfaConnectionHandler implements Runnable {
  private static final Logger LOGGER = Logger.getLogger(MfaConnectionHandler.class.getName());

  private final Socket socket;
  private final MfaCodec codec;
  private final Function<MfaMessage, MfaResponse> processor;
  private final AtomicLong completedRequests;
  private final AtomicLong failedRequests;

  MfaConnectionHandler(
      Socket socket,
      MfaCodec codec,
      Function<MfaMessage, MfaResponse> processor,
      AtomicLong completedRequests,
      AtomicLong failedRequests) {
    this.socket = socket;
    this.codec = codec;
    this.processor = processor;
    this.completedRequests = completedRequests;
    this.failedRequests = failedRequests;
  }

  @Override
  public void run() {
    try {
      // read → decode → business → encode → write 순서를 한 worker에서 완료한다.
      byte[] requestFrame = MfaFrameReader.read(socket.getInputStream());
      MfaResponse response = processor.apply(codec.decode(requestFrame));
      socket.getOutputStream().write(codec.encode(response));
      socket.getOutputStream().flush();
      completedRequests.incrementAndGet();
    } catch (SocketTimeoutException e) {
      // 106바이트를 timeout 안에 보내지 않는 slow client의 worker 점유를 해제한다.
      failedRequests.incrementAndGet();
      LOGGER.log(Level.WARNING, "MFA 요청 읽기 시간이 초과됐습니다: {0}", remoteAddress());
    } catch (MfaProtocolException e) {
      failedRequests.incrementAndGet();
      // 연결이 아직 살아 있으면 호출자가 원인을 판별할 수 있도록 E/400을 시도한다.
      sendProtocolError();
      LOGGER.log(Level.WARNING, "잘못된 MFA 전문을 거부했습니다: {0}", remoteAddress());
    } catch (IOException | RuntimeException e) {
      failedRequests.incrementAndGet();
      LOGGER.log(Level.SEVERE, "MFA 요청 처리 중 오류가 발생했습니다: " + remoteAddress(), e);
    } finally {
      try {
        socket.close();
      } catch (IOException ignored) {
        // 요청 처리가 끝난 연결은 항상 닫는다.
      }
    }
  }

  /** protocol parsing 실패 시 최소 오류 응답을 전송하며, 전송 실패는 원래 오류보다 우선하지 않는다. */
  private void sendProtocolError() {
    try {
      socket
          .getOutputStream()
          .write(codec.encode(MfaResponse.protocolError("Request Message Error")));
      socket.getOutputStream().flush();
    } catch (Exception ignored) {
      // 연결 자체가 끊겼다면 오류 응답을 보낼 수 없다.
    }
  }

  /** 민감한 전문 내용 없이 접속 출처만 로깅하기 위한 문자열을 반환한다. */
  private String remoteAddress() {
    return socket.getRemoteSocketAddress() == null ? "unknown" : socket.getRemoteSocketAddress().toString();
  }
}
