import { describe, expect, it } from "vitest";
import { createImageDecoder } from "./image-decoder";
describe("이미지 decode 선택과 ObjectURL 수명", () => {
  function fixture() {
    const completions: { resolve: () => void; reject: () => void }[] = [];
    const revoked: string[] = [];
    let count = 0;
    const decoder = createImageDecoder({
      createURL: () => `blob:synthetic-${++count}`,
      revokeURL: (url) => revoked.push(url),
      createImage: () => {
        const image = new Image();
        Object.defineProperties(image, {
          naturalWidth: { value: 640 },
          naturalHeight: { value: 480 },
        });
        image.decode = () =>
          new Promise<void>((resolve, reject) => {
            completions.push({ resolve, reject: () => reject(new Error("synthetic")) });
          });
        return image;
      },
    });
    return { decoder, completions, revoked };
  }
  it("선택을 바꾼 뒤 완료된 이전 이미지가 새 이미지에 반영되지 않는다", async () => {
    const { decoder, completions, revoked } = fixture();
    const first = decoder.decode(new Blob(["first"]));
    const second = decoder.decode(new Blob(["second"]));
    completions[1]!.resolve();
    expect((await second)?.src).toContain("synthetic-2");
    completions[0]!.resolve();
    expect(await first).toBeNull();
    expect(revoked).toEqual(["blob:synthetic-1"]);
    decoder.dispose();
    expect(revoked).toEqual(["blob:synthetic-1", "blob:synthetic-2"]);
  });
  it("이전 이미지 실패가 현재 URL을 해제하거나 현재 오류를 만들지 않는다", async () => {
    const { decoder, completions, revoked } = fixture();
    const first = decoder.decode(new Blob(["first"]));
    const second = decoder.decode(new Blob(["second"]));
    completions[0]!.reject();
    expect(await first).toBeNull();
    completions[1]!.resolve();
    expect(await second).not.toBeNull();
    expect(revoked).toEqual(["blob:synthetic-1"]);
    decoder.dispose();
  });
  it("현재 decode 실패와 unmount는 각각 소유 URL을 한 번 정리한다", async () => {
    const { decoder, completions, revoked } = fixture();
    const failed = decoder.decode(new Blob(["bad"]));
    const rejected = expect(failed).rejects.toThrow("이미지를 해석하지 못했습니다.");
    completions[0]!.reject();
    await rejected;
    const pending = decoder.decode(new Blob(["pending"]));
    decoder.dispose();
    completions[1]!.resolve();
    expect(await pending).toBeNull();
    decoder.dispose();
    expect(revoked).toEqual(["blob:synthetic-1", "blob:synthetic-2"]);
    expect(await decoder.decode(new Blob())).toBeNull();
  });
});
