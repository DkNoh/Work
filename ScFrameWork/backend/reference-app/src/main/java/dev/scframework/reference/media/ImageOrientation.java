package dev.scframework.reference.media;

import java.io.*;
import java.util.Arrays;

/** EXIF만 제한적으로 읽으며 원본 bytes를 변환하거나 재압축하지 않는다. */
final class ImageOrientation {
    private static final byte[] PNG = {(byte)137,80,78,71,13,10,26,10};
    private static final byte[] EXIF = {69,120,105,102,0,0};
    private ImageOrientation() {}
    static int read(InputStream source, boolean png) throws IOException {
        DataInputStream input = new DataInputStream(source);
        return png ? png(input) : jpeg(input);
    }
    private static int jpeg(DataInputStream input) throws IOException {
        if (input.readUnsignedShort()!=0xffd8) throw invalid();
        int orientation=1; boolean found=false;
        while (true) {
            if (input.readUnsignedByte()!=0xff) throw invalid();
            int marker; do { marker=input.readUnsignedByte(); } while (marker==0xff);
            if (marker==0xda || marker==0xd9) return orientation;
            if (marker==0x01 || (marker>=0xd0 && marker<=0xd7)) continue;
            int length=input.readUnsignedShort()-2; if(length<0) throw invalid();
            byte[] data=input.readNBytes(length); if(data.length!=length) throw invalid();
            if(marker==0xe1 && data.length>=6 && Arrays.equals(Arrays.copyOf(data,6),EXIF)) {
                if(found) throw invalid(); found=true; orientation=tiff(Arrays.copyOfRange(data,6,data.length));
            }
        }
    }
    private static int png(DataInputStream input) throws IOException {
        if(!Arrays.equals(input.readNBytes(8),PNG)) throw invalid();
        int orientation=1;boolean found=false;
        while(true) {
            long length=Integer.toUnsignedLong(input.readInt()); int type=input.readInt();
            if(length>MediaService.MAX_BYTES) throw invalid();
            if(type==0x65584966) {
                // PNG eXIf의 대용량 TIFF 메타데이터는 지원하지 않는다.
                if(found || length>65533) throw invalid(); found=true;
                byte[] data=input.readNBytes((int)length); if(data.length!=length) throw invalid(); orientation=tiff(data);
            } else input.skipNBytes(length);
            input.skipNBytes(4);
            if(type==0x49454e44) return orientation;
        }
    }
    static int tiff(byte[] bytes) throws IOException {
        if(bytes.length<8) throw invalid();
        boolean little;
        if(bytes[0]=='I' && bytes[1]=='I') little=true;
        else if(bytes[0]=='M' && bytes[1]=='M') little=false;
        else throw invalid();
        if(u16(bytes,2,little)!=42) throw invalid();
        long offset=u32(bytes,4,little);
        if(offset<8 || offset>bytes.length-2) throw invalid();
        int start=(int)offset,count=u16(bytes,start,little);
        if(count>4096 || (long)start+2+12L*count+4>bytes.length) throw invalid();
        int orientation=1;boolean found=false;
        for(int i=0;i<count;i++) {
            int entry=start+2+12*i;
            if(u16(bytes,entry,little)==0x0112) {
                if(found || u16(bytes,entry+2,little)!=3 || u32(bytes,entry+4,little)!=1) throw invalid();
                found=true;orientation=u16(bytes,entry+8,little);if(orientation<1 || orientation>8) throw invalid();
            }
        }
        return orientation;
    }
    private static int u16(byte[] bytes,int offset,boolean little) { return little ? (bytes[offset]&255)|((bytes[offset+1]&255)<<8) : ((bytes[offset]&255)<<8)|(bytes[offset+1]&255); }
    private static long u32(byte[] bytes,int offset,boolean little) {
        long value=0;for(int i=0;i<4;i++) value=(value<<8)|(bytes[offset+(little?3-i:i)]&255);return value;
    }
    private static IOException invalid() { return new IOException("Unsupported image orientation metadata"); }
}
