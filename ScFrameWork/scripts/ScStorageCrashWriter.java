import dev.scframework.autoconfigure.storage.LocalFileStorage;
import java.io.InputStream;
import java.nio.file.Path;

/** 검증 CLI 전용 child: 실제 adapter가 journal/partial을 쓴 뒤 부모가 이 PID만 SIGKILL한다. */
class ScStorageCrashWriter {
    public static void main(String[] args)throws Exception {
        if(args.length!=1)throw new IllegalArgumentException("SC_CRASH_FIXTURE_ROOT_REQUIRED");
        try(LocalFileStorage storage=new LocalFileStorage(Path.of(args[0]),1024*1024,true)){
            storage.write(new InputStream(){int reads;
                @Override public int read(){throw new UnsupportedOperationException();}
                @Override public int read(byte[] bytes,int offset,int length)throws java.io.IOException{
                    if(reads++==0){java.util.Arrays.fill(bytes,offset,offset+Math.min(length,1024),(byte)7);return Math.min(length,1024);}
                    System.out.println("SC_PARTIAL_READY");System.out.flush();
                    try{Thread.sleep(60000);}catch(InterruptedException interrupted){Thread.currentThread().interrupt();throw new java.io.IOException("SC_CRASH_FIXTURE_INTERRUPTED");}
                    return -1;
                }
            },1024*1024);
        }
    }
}
