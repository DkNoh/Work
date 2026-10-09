package dev.scframework.reference.documents;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import dev.scframework.core.*;
import java.net.URI;
import java.net.URL;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.nio.charset.CodingErrorAction;
import java.math.BigInteger;
import java.text.Normalizer;
import java.math.BigDecimal;
import java.util.*;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * 프런트 rich text 문법을 서버에서 다시 검증하고 허용 필드만 새 JSON 트리로 구성한다.
 * 허용 노드/marks/링크·깊이·노드 수·텍스트 크기를 검사하며 전체 HTML/WHATWG URL 구현이라고 가정하지 않는다.
 */

/** UI editor/document.ts의 문법을 서버에서도 검사한다. HTML과 vendor 속성은 저장하지 않는다. */
@Component
public final class DocumentGrammar {
 private static final Set<String> BLOCKS=Set.of("paragraph","heading","bulletList","orderedList");
 private static final Set<String> SIMPLE_MARKS=Set.of("bold","italic","underline","strike","code");
 private static final Pattern SCHEME=Pattern.compile("^([a-z][a-z\\d+.-]*):",Pattern.CASE_INSENSITIVE);
 private final ObjectMapper json;
 public DocumentGrammar(ObjectMapper json){this.json=json;}
 // JSON을 파싱해 doc 루트를 확인한 뒤 새 트리로 정규화한다. 실패는 documentJson 필드 오류로 매핑되어 프런트 편집기 아래에 표시된다.
 public String validate(String source){
  try {
   JsonNode root=json.readTree(source);
   require(root!=null&&root.isObject()&&"doc".equals(root.path("type").asText())&&root.path("content").isArray()&&!root.path("content").isEmpty());keys(root,Set.of("type","content"));
   State state=new State();ObjectNode result=json.createObjectNode().put("type","doc");ArrayNode content=result.putArray("content");
   for(JsonNode child:root.get("content"))content.add(node(child,"doc",1,state));
   return json.writeValueAsString(result);
  } catch(JsonProcessingException|IllegalArgumentException failure){throw new ApiException(400,"INVALID_INPUT","문서 형식 또는 링크를 확인하세요.",List.of(new FieldViolation("documentJson","허용된 문서 JSON 문법과 크기 제한을 확인하세요.")));}
 }
 // 재귀 진입마다 노드 수/깊이를 먼저 제한한다. 부모 종류가 허용하는 자식만 받아 임의 vendor node/속성을 저장하지 않는다.
 private ObjectNode node(JsonNode raw,String parent,int depth,State state){
  require(raw.isObject()&&raw.path("type").isTextual());require(++state.nodes<=10000&&depth<=32);keys(raw,Set.of("type","content","text","marks","attrs"));
  String type=raw.get("type").textValue();Set<String> allowed=parent.equals("doc")||parent.equals("listItem")?BLOCKS:parent.equals("bulletList")||parent.equals("orderedList")?Set.of("listItem"):Set.of("text","hardBreak");require(allowed.contains(type));
  ObjectNode result=json.createObjectNode().put("type",type);
  // text는 비어 있지 않은 문자열이며 총 길이를 누적 검사한다. mark도 중복 종류/알 수 없는 속성을 거절하고 link만 href를 받는다.
  if(type.equals("text")){
   require(raw.path("text").isTextual()&&!raw.get("text").textValue().isEmpty()&&!raw.has("content")&&!raw.has("attrs"));String text=raw.get("text").textValue();state.text+=text.length();require(state.text<=1000000);result.put("text",text);
   if(raw.has("marks")){require(raw.get("marks").isArray());Set<String> seen=new HashSet<>();ArrayNode marks=json.createArrayNode();
    for(JsonNode mark:raw.get("marks")){require(mark.isObject()&&mark.path("type").isTextual());keys(mark,Set.of("type","attrs"));String kind=mark.get("type").textValue();require(seen.add(kind));ObjectNode normalized=json.createObjectNode().put("type",kind);
     if(kind.equals("link")){JsonNode attrs=mark.get("attrs");require(attrs!=null&&attrs.isObject());keys(attrs,Set.of("href"));require(attrs.path("href").isTextual()&&safeLink(attrs.get("href").textValue()));normalized.putObject("attrs").put("href",attrs.get("href").textValue());}
     else require(SIMPLE_MARKS.contains(kind)&&!mark.has("attrs"));marks.add(normalized);
    }if(!marks.isEmpty())result.set("marks",marks);
   }return result;
  }
  require(!raw.has("text")&&!raw.has("marks"));
  if(type.equals("hardBreak")){require(!raw.has("content")&&!raw.has("attrs"));return result;}
  // heading.level과 orderedList.start는 범위 내 정확한 정수여야 한다. 임의 attrs가 화면 동작/HTML 속성으로 새어나가지 않게 한다.
  if(type.equals("heading")){JsonNode attrs=raw.get("attrs");require(attrs!=null&&attrs.isObject());keys(attrs,Set.of("level"));long level=integer(attrs.get("level"),6);result.putObject("attrs").put("level",level);}
  else if(type.equals("orderedList")&&raw.has("attrs")){JsonNode attrs=raw.get("attrs");require(attrs.isObject());keys(attrs,Set.of("start"));long start=integer(attrs.get("start"),9007199254740991L);result.putObject("attrs").put("start",start);}
  else require(!raw.has("attrs"));
  require(!raw.has("content")||raw.get("content").isArray());ArrayNode children=json.createArrayNode();if(raw.has("content"))for(JsonNode child:raw.get("content"))children.add(node(child,type,depth+1,state));
  if(Set.of("bulletList","orderedList","listItem").contains(type))require(!children.isEmpty());
  if(type.equals("listItem"))require("paragraph".equals(children.get(0).path("type").asText()));if(!children.isEmpty())result.set("content",children);return result;
 }
 // 숫자 JSON을 longValueExact로 변환해 소수/오버플로를 거절한다. JavaScript 쪽 정수 표현 범위와 맞춰 orderedList 시작값도 제한한다.
 private static long integer(JsonNode raw,long max){require(raw!=null&&raw.isNumber());try{BigDecimal number=raw.decimalValue();long value=number.longValueExact();require(value>=1&&value<=max);return value;}catch(ArithmeticException failure){throw new IllegalArgumentException("Invalid document integer");}}
 // 허용 키 목록 밖의 필드는 무시해 저장하는 대신 거절한다. 예상치 못한 vendor 속성이 문서 모델에 누적되지 않게 한다.
 private static void keys(JsonNode node,Set<String> allowed){node.fieldNames().forEachRemaining(key->require(allowed.contains(key)));}
 private static void require(boolean condition){if(!condition)throw new IllegalArgumentException("Invalid document grammar");}
 // 편집기에서 지원하는 상대/http/https/mailto 링크 문법만 검사한다. 네트워크 접속/URL 대상 안전성 조회를 수행하는 함수는 아니다.
 // 제어문자·역슬래시·가장자리 공백과 허용하지 않은 scheme을 선행 거절한다.
 static boolean safeLink(String href){
  if(href.isEmpty()||href.codePoints().anyMatch(c->c<=32||c==127)||href.indexOf('\\')>=0||jsSpace(href.codePointAt(0))||jsSpace(href.codePointBefore(href.length())))return false;
  var match=SCHEME.matcher(href);if(!match.find())return !href.contains(":");String scheme=match.group(1).toLowerCase(Locale.ROOT);if(!Set.of("http","https","mailto").contains(scheme))return false;
  String rest=href.substring(match.end());
  // mailto는 opaque pathname이다. WHATWG URL처럼 query/hash만 있는 주소는 빈 pathname으로 거절한다.
  if(scheme.equals("mailto")){int end=rest.length();for(char separator:new char[]{'?','#'}){int pos=rest.indexOf(separator);if(pos>=0)end=Math.min(end,pos);}String path=rest.substring(0,end);if(path.startsWith("//")){int slash=path.indexOf('/',2);path=slash<0?"":path.substring(slash);}return !path.isEmpty();}
  try{
   rest=rest.replaceFirst("^/+","");int end=rest.length();for(char separator:new char[]{'/','?','#'}){int pos=rest.indexOf(separator);if(pos>=0)end=Math.min(end,pos);}String authority=rest.substring(0,end);int user=authority.lastIndexOf('@');String hostPort=authority.substring(user+1);if(hostPort.isEmpty())return false;
   String host,port="";
   if(hostPort.startsWith("[")){int close=hostPort.indexOf(']');if(close<0)return false;host=hostPort.substring(0,close+1);String tail=hostPort.substring(close+1);if(!tail.isEmpty()){if(!tail.startsWith(":"))return false;port=tail.substring(1);}if(host.indexOf('%')>=0||new URI("http://"+host).getHost()==null)return false;}
   else {int colon=hostPort.lastIndexOf(':');host=colon<0?hostPort:hostPort.substring(0,colon);port=colon<0?"":hostPort.substring(colon+1);host=decodeHost(host);String normalized=Normalizer.normalize(host,Normalizer.Form.NFKC).replace('\u3002','.');
    if(normalized.isEmpty()||normalized.codePoints().anyMatch(c->c<=32||c==127||"#/:?@[\\]^|<>%".indexOf(c)>=0||c==0xfffd||c==0x200c||c==0x200d||c>=0xd800&&c<=0xdfff))return false;
    if(!validIpv4IfNumeric(normalized))return false;
   }
   if(!port.isEmpty()&&(!port.matches("[0-9]+")||new BigInteger(port).compareTo(BigInteger.valueOf(65535))>0))return false;
   // URL의 path는 %zz 같은 literal percent도 허용한다. URI로 전체 주소를 검증하면 editor와 달리 거절하게 된다.
   return !host.isEmpty()&&new URL(scheme+"://"+host+(port.isEmpty()?"":":"+port)).getHost().length()>0;
  }catch(Exception invalid){return false;}
 }
 // 호스트의 percent escape를 UTF-8로 엄격히 해석한다. 잘못된 바이트를 대체 문자로 조용히 통과시키지 않는다.
 private static String decodeHost(String host)throws Exception{
  ByteArrayOutputStream bytes=new ByteArrayOutputStream();
  for(int i=0;i<host.length();){char c=host.charAt(i);if(c=='%'){if(i+2>=host.length())throw new IllegalArgumentException("Invalid host escape");int high=Character.digit(host.charAt(i+1),16),low=Character.digit(host.charAt(i+2),16);if(high<0||low<0)throw new IllegalArgumentException("Invalid host escape");bytes.write((high<<4)|low);i+=3;}
   else {int cp=host.codePointAt(i);bytes.write(new String(Character.toChars(cp)).getBytes(StandardCharsets.UTF_8));i+=Character.charCount(cp);}}
  return StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes.toByteArray())).toString();
 }
 // 숫자처럼 끝나는 호스트는 지원하는 IPv4 10/8/16진수 표기 범위까지 검사한다. 일반 도메인을 IPv4로 강제 변환하지 않는다.
 private static boolean validIpv4IfNumeric(String host){
  String value=host.endsWith(".")?host.substring(0,host.length()-1):host;String[] parts=value.split("\\.",-1);String last=parts[parts.length-1];boolean numeric=last.matches("[0-9]+")||last.matches("(?i)0x[0-9a-f]*");if(!numeric)return true;if(parts.length>4)return false;
  try{for(int i=0;i<parts.length;i++){String part=parts[i];if(part.isEmpty())return false;int radix=10;if(part.matches("(?i)0x.*")){radix=16;part=part.substring(2);}else if(part.length()>1&&part.charAt(0)=='0'){radix=8;part=part.substring(1);}BigInteger number=part.isEmpty()?BigInteger.ZERO:new BigInteger(part,radix);if(number.signum()<0)return false;BigInteger max=i==parts.length-1?BigInteger.valueOf(256).pow(5-parts.length).subtract(BigInteger.ONE):BigInteger.valueOf(255);if(number.compareTo(max)>0)return false;}return true;}catch(NumberFormatException invalid){return false;}
 }
 private static boolean jsSpace(int c){return Character.isWhitespace(c)||Character.isSpaceChar(c)||c==0xfeff;}
 // 하나의 문서 재귀 전체에서 노드 수/텍스트 길이를 합산한다. 자식마다 새 State를 만들면 전체 크기 제한을 우회하게 된다.
 private static final class State{int nodes;long text;}
}
