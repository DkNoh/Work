package dev.scframework.reference.documents;
import static org.assertj.core.api.Assertions.*;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import dev.scframework.core.ApiException;
import java.util.*;
import org.junit.jupiter.api.Test;
class DocumentGrammarTest {
 private final ObjectMapper json=new ObjectMapper();private final DocumentGrammar grammar=new DocumentGrammar(json);
 @Test void sharedGoldenLinksMatchActualFrontendValidator()throws Exception{
  try(var input=getClass().getResourceAsStream("/document-link-vectors.json")){assertThat(input).isNotNull();for(JsonNode vector:json.readTree(input)){assertThat(DocumentGrammar.safeLink(vector.get("href").asText())).as(vector.get("href").asText()).isEqualTo(vector.get("allowed").asBoolean());}}
 }
 @Test void acceptedEditorGrammarNormalizesWithoutHtmlAndPreservesText()throws Exception{
  String input="""
   {"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"한글 ","marks":[{"type":"bold"},{"type":"link","attrs":{"href":"https://example.com/a"}}]}]},{"type":"paragraph","content":[{"type":"hardBreak"}]},{"type":"orderedList","attrs":{"start":3},"content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":" 항목\\n "}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph"}]}]}]}]}]}
   """;
  JsonNode result=json.readTree(grammar.validate(input));assertThat(result).isEqualTo(json.readTree(input));assertThat(grammar.validate(grammar.validate(input))).isEqualTo(grammar.validate(input));
  assertThat(json.readTree(grammar.validate("{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"content\":[]}]}"))).isEqualTo(json.readTree("{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\"}]}"));
 }
 @Test void unsafeLinksAndUnsupportedNodesAttributesCannotEnterStorage(){
  for(String href:List.of("javascript:alert(1)","data:text/html,x","file:///etc/a","vbscript:x"," https://example.com","https://example.com\n","mailto:","https://","http://[broken","\\evil","a:b","\u00a0x"))assertThat(DocumentGrammar.safeLink(href)).as("unsafe link category").isFalse();
  for(String href:List.of("https://example.com","HTTP://example.com/a?b=1#c","mailto:user@example.com","/local","../guide","guide","#part","?page=2","https:example.com"))assertThat(DocumentGrammar.safeLink(href)).as(href).isTrue();
  for(String source:List.of("<p>html</p>","[]","{\"type\":\"doc\",\"content\":[]}","{\"type\":\"doc\",\"content\":[{\"type\":\"image\"}]}","{\"type\":\"doc\",\"html\":\"x\",\"content\":[{\"type\":\"paragraph\"}]}","{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"attrs\":{\"style\":\"x\"}}]}"))reject(source);
 }
 @Test void marksAreUniqueAndOnlyLinkHasPermittedAttributes()throws Exception{
  for(ObjectNode mark:List.<ObjectNode>of(json.createObjectNode().put("type","script"),json.createObjectNode().put("type","bold").set("attrs",json.createObjectNode()),json.createObjectNode().put("type","link").set("attrs",json.createObjectNode().put("href","/safe").put("target","_blank")))){ObjectNode doc=text("hello");((ObjectNode)doc.path("content").get(0).path("content").get(0)).putArray("marks").add(mark);reject(doc.toString());}
  ObjectNode doc=text("text");((ObjectNode)doc.path("content").get(0).path("content").get(0)).putArray("marks").addObject().put("type","bold");((ArrayNode)doc.path("content").get(0).path("content").get(0).path("marks")).addObject().put("type","bold");reject(doc.toString());
 }
 @Test void listsHeadingLevelsAndNumberBoundsMatchEditor(){
  for(String child:List.of("{\"type\":\"heading\",\"attrs\":{\"level\":0}}","{\"type\":\"heading\",\"attrs\":{\"level\":7}}","{\"type\":\"orderedList\",\"content\":[]}","{\"type\":\"bulletList\",\"content\":[{\"type\":\"paragraph\"}]}","{\"type\":\"orderedList\",\"attrs\":{\"start\":9007199254740992},\"content\":[{\"type\":\"listItem\",\"content\":[{\"type\":\"paragraph\"}]}]}"))reject("{\"type\":\"doc\",\"content\":["+child+"]}");
  assertThatCode(()->grammar.validate("{\"type\":\"doc\",\"content\":[{\"type\":\"heading\",\"attrs\":{\"level\":1.0}}]}" )).doesNotThrowAnyException();
 }
 @Test void utf16TextNodeCountAndDepthLimitsAreEnforced(){
  assertThatCode(()->grammar.validate(text("x".repeat(1000000)).toString())).doesNotThrowAnyException();reject(text("x".repeat(1000001)).toString());reject(text("😀".repeat(500001)).toString());
  ObjectNode root=json.createObjectNode().put("type","doc");ArrayNode content=root.putArray("content");for(int i=0;i<10000;i++)content.addObject().put("type","paragraph");assertThatCode(()->grammar.validate(root.toString())).doesNotThrowAnyException();content.addObject().put("type","paragraph");reject(root.toString());
  ObjectNode deep=json.createObjectNode().put("type","doc"),parent=deep;for(int i=0;i<17;i++){ObjectNode list=parent.putArray("content").addObject().put("type","bulletList");ObjectNode item=list.putArray("content").addObject().put("type","listItem");item.putArray("content").addObject().put("type","paragraph");parent=item;}reject(deep.toString());
 }
 private ObjectNode text(String text){ObjectNode doc=json.createObjectNode().put("type","doc");doc.putArray("content").addObject().put("type","paragraph").putArray("content").addObject().put("type","text").put("text",text);return doc;}
 private void reject(String source){assertThatThrownBy(()->grammar.validate(source)).isInstanceOfSatisfying(ApiException.class,error->assertThat(error.getMessage()).doesNotContain(source));}
}
