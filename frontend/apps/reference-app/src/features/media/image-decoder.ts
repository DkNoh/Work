/**
 * 서버 Blob을 브라우저 HTMLImageElement로 해석하는 작은 상태 관리 모듈. Vue에 의존하지 않아 URL/Image 동작을 주입해 단위 검증할 수 있다.
 * epoch는 decode 작업의 순번이다. 새 이미지 선택 후 이전 decode가 완료되어도 새 선택의 결과로 돌려주지 않는다.
 * Object URL은 파일 내용을 참조하는 브라우저 메모리 자원이므로 clear/dispose에서 revoke한다. 영구 서버 URL로 저장하지 않는다.
 */
type ImageDecoderOptions = {
  createURL: (blob: Blob) => string;
  revokeURL: (url: string) => void;
  createImage: () => HTMLImageElement;
};
/** 비동기 decode의 선택 소유권과 ObjectURL 수명만 관리한다. 서버 metadata는 Query가 소유한다. */
export function createImageDecoder(
  options: ImageDecoderOptions = {
    createURL: URL.createObjectURL,
    revokeURL: URL.revokeObjectURL,
    createImage: () => new Image(),
  },
) {
  let epoch = 0;
  let currentURL: string | null = null;
  let disposed = false;
  function clear() {
    epoch++;
    if (currentURL) options.revokeURL(currentURL);
    currentURL = null;
  }
  /**
   * image.decode()는 비동기 이미지 해석 완료를 기다린다. 실패 시 현재 작업인 경우에만 정리/오류를 전달하고 이미 교체된 작업은 조용히 버린다.
   */
  async function decode(blob: Blob): Promise<HTMLImageElement | null> {
    if (disposed) return null;
    clear();
    const selection = epoch;
    const url = options.createURL(blob);
    currentURL = url;
    const image = options.createImage();
    image.src = url;
    try {
      await image.decode();
      if (disposed || selection !== epoch) return null;
      if (!image.naturalWidth || !image.naturalHeight)
        throw new Error("이미지를 해석하지 못했습니다.");
      return image;
    } catch {
      if (disposed || selection !== epoch) return null;
      clear();
      throw new Error("이미지를 해석하지 못했습니다.");
    }
  }
  return {
    decode,
    clear,
    dispose() {
      disposed = true;
      clear();
    },
  };
}
