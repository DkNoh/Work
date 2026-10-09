package dev.scframework.reference.media;

import static org.assertj.core.api.Assertions.*;
import java.io.*;
import java.nio.*;
import org.junit.jupiter.api.Test;

class ImageOrientationTest {
    @Test void jpegExifSupportsBothEndianEncodingsAndAllValidAxes() throws Exception {
        for(boolean little:new boolean[]{true,false}) for(int value=1;value<=8;value++) {
            assertThat(ImageOrientation.read(new ByteArrayInputStream(jpeg(exif(value,little))),false)).isEqualTo(value);
        }
        assertThat(ImageOrientation.read(new ByteArrayInputStream(new byte[]{(byte)255,(byte)216,(byte)255,(byte)218}),false)).isEqualTo(1);
    }
    @Test void invalidExifOffsetsEndianTypesCountsAndValuesFailBoundedly() {
        for(byte[] invalid:new byte[][]{new byte[]{'X','X',0,0,0,0,0,0},exif(0,true),exif(9,false)})
            assertThatThrownBy(()->ImageOrientation.read(new ByteArrayInputStream(jpeg(invalid)),false)).isInstanceOf(IOException.class);
        byte[] hugeOffset=exif(6,true);ByteBuffer.wrap(hugeOffset).order(ByteOrder.LITTLE_ENDIAN).putInt(4,Integer.MAX_VALUE);
        assertThatThrownBy(()->ImageOrientation.read(new ByteArrayInputStream(jpeg(hugeOffset)),false)).isInstanceOf(IOException.class);
        byte[] hugeCount=exif(6,true);ByteBuffer.wrap(hugeCount).order(ByteOrder.LITTLE_ENDIAN).putShort(8,(short)65535);
        assertThatThrownBy(()->ImageOrientation.read(new ByteArrayInputStream(jpeg(hugeCount)),false)).isInstanceOf(IOException.class);
        byte[] wrongType=exif(6,true);ByteBuffer.wrap(wrongType).order(ByteOrder.LITTLE_ENDIAN).putShort(12,(short)4);
        assertThatThrownBy(()->ImageOrientation.read(new ByteArrayInputStream(jpeg(wrongType)),false)).isInstanceOf(IOException.class);
    }
    static byte[] exif(int orientation,boolean little) {
        ByteBuffer tiff=ByteBuffer.allocate(26).order(little?ByteOrder.LITTLE_ENDIAN:ByteOrder.BIG_ENDIAN);
        tiff.put((byte)(little?'I':'M')).put((byte)(little?'I':'M')).putShort((short)42).putInt(8);
        tiff.putShort((short)1).putShort((short)0x0112).putShort((short)3).putInt(1).putShort((short)orientation).putShort((short)0).putInt(0);return tiff.array();
    }
    static byte[] jpeg(byte[] tiff) throws IOException {
        ByteArrayOutputStream bytes=new ByteArrayOutputStream();DataOutputStream output=new DataOutputStream(bytes);
        output.writeShort(0xffd8);output.writeShort(0xffe1);output.writeShort(tiff.length+8);output.write(new byte[]{69,120,105,102,0,0});output.write(tiff);output.writeShort(0xffda);return bytes.toByteArray();
    }
}
