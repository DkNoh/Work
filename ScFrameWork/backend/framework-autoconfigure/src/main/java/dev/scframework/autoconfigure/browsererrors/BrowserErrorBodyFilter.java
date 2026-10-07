package dev.scframework.autoconfigure.browsererrors;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.scframework.core.ApiError;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

/** Content-Length 없는 요청도 제한+1 byte까지만 읽고, 원문을 로그나 예외에 남기지 않는다. */
public final class BrowserErrorBodyFilter extends OncePerRequestFilter {
    private final ScBrowserErrorsProperties properties;
    private final ObjectMapper mapper;
    private final BrowserErrorService service;
    public BrowserErrorBodyFilter(ScBrowserErrorsProperties properties,ObjectMapper mapper,BrowserErrorService service){this.properties=properties;this.mapper=mapper;this.service=service;}
    @Override protected boolean shouldNotFilter(HttpServletRequest request){return !"POST".equals(request.getMethod())||!request.getRequestURI().equals(request.getContextPath()+"/api/operations/browser-errors");}
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain)throws ServletException,IOException{
        boolean json=false;
        try{json=request.getContentType()!=null&&MediaType.APPLICATION_JSON.isCompatibleWith(MediaType.parseMediaType(request.getContentType()));}catch(IllegalArgumentException ignored){}
        if(!json){reject(response,415,"UNSUPPORTED_MEDIA_TYPE","JSON 오류 보고만 지원합니다.");return;}
        int maximum=properties.getMaxBodyBytes();
        if(request.getContentLengthLong()>maximum){reject(response,413,"REPORT_TOO_LARGE","오류 보고 크기 제한을 넘었습니다.");return;}
        byte[] bytes=request.getInputStream().readNBytes(maximum+1);
        if(bytes.length>maximum){reject(response,413,"REPORT_TOO_LARGE","오류 보고 크기 제한을 넘었습니다.");return;}
        try{
            com.fasterxml.jackson.databind.JsonNode tree=mapper.reader().with(com.fasterxml.jackson.core.JsonParser.Feature.STRICT_DUPLICATE_DETECTION).with(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_TRAILING_TOKENS).readTree(bytes);
            var fields=java.util.Set.of("schemaVersion","clientEventId","source","eventCode","appVersion","routeCode","componentCode");
            if(!tree.isObject()||tree.size()!=7||!tree.path("schemaVersion").isIntegralNumber())throw new IllegalArgumentException();
            var names=tree.fieldNames();while(names.hasNext())if(!fields.contains(names.next()))throw new IllegalArgumentException();
            for(String field:fields)if(!field.equals("schemaVersion")&&!tree.path(field).isTextual())throw new IllegalArgumentException();
        }catch(Exception invalid){reject(response,400,"INVALID_INPUT","오류 보고 형식을 확인해 주세요.");return;}
        chain.doFilter(new BufferedRequest(request,bytes),response);
    }
    private void reject(HttpServletResponse response,int status,String code,String message)throws IOException{
        service.rejected();response.setStatus(status);response.setContentType(MediaType.APPLICATION_JSON_VALUE);response.setCharacterEncoding("UTF-8");mapper.writeValue(response.getOutputStream(),ApiError.of(code,message));
    }
    private static final class BufferedRequest extends HttpServletRequestWrapper {
        private final byte[] bytes;
        BufferedRequest(HttpServletRequest request,byte[] bytes){super(request);this.bytes=bytes;}
        @Override public int getContentLength(){return bytes.length;}
        @Override public long getContentLengthLong(){return bytes.length;}
        @Override public ServletInputStream getInputStream(){
            var input=new ByteArrayInputStream(bytes);
            return new ServletInputStream(){
                @Override public int read(){return input.read();}
                @Override public int read(byte[] buffer,int offset,int length){return input.read(buffer,offset,length);}
                @Override public boolean isFinished(){return input.available()==0;}
                @Override public boolean isReady(){return true;}
                @Override public void setReadListener(ReadListener listener){throw new IllegalStateException("Synchronous report input only");}
            };
        }
        @Override public BufferedReader getReader(){return new BufferedReader(new InputStreamReader(getInputStream(),StandardCharsets.UTF_8));}
    }
}
