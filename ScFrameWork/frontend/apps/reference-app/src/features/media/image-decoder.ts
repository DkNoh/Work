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
