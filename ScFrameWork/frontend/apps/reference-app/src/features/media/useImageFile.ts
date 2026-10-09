/**
 * 인증된 파일 조회와 브라우저 이미지 해석을 조합한 composable. use로 시작하는 함수는 Vue 상태/수명 로직을 여러 화면에서 재사용하는 관례다.
 * 입력 ComputedRef<number | null>은 현재 파일 선택을 읽는 반응형 참조다. 선택이 바뀌면 Query 키와 decode 감시가 함께 바뀐다.
 * 서버 Blob은 Query가 보관하고 실제 DOM 이미지 객체는 shallowRef에 둔다. shallowRef는 HTMLImageElement 내부까지 반응형 Proxy로 감싸지 않는다.
 */
import { computed, onBeforeUnmount, shallowRef, ref, watch, type ComputedRef } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useReferenceRuntime } from "../../auth/identity";
import { createMediaApi, mediaKeys } from "./api";
import { createImageDecoder } from "./image-decoder";

export function useImageFile(fileId: ComputedRef<number | null>) {
  const runtime = useReferenceRuntime();
  const api = createMediaApi(runtime);
  const query = useQuery({
    queryKey: computed(() => mediaKeys.file(fileId.value)),
    queryFn: ({ queryKey, signal }) => api.file(queryKey[1]!, signal),
    enabled: computed(() => !!runtime.session.identity && fileId.value !== null),
  });
  const image = shallowRef<HTMLImageElement | null>(null);
  const decoding = ref(false);
  const decodeError = ref("");
  const decoder = createImageDecoder();
  let selection = 0;
  /**
   * Blob/파일 ID/사용자 ID를 함께 감시한다. 새로운 선택 순번을 발급하고 현재 순번의 결과만 image/error/loading에 반영한다.
   */
  watch(
    () => [query.data.value, fileId.value, runtime.session.identity?.id] as const,
    async ([blob]) => {
      const epoch = ++selection;
      image.value = null;
      decodeError.value = "";
      decoder.clear();
      if (!blob || !runtime.session.identity) {
        decoding.value = false;
        return;
      }
      decoding.value = true;
      try {
        const result = await decoder.decode(blob);
        if (selection === epoch) image.value = result;
      } catch (cause) {
        if (selection === epoch)
          decodeError.value =
            cause instanceof Error ? cause.message : "이미지를 해석하지 못했습니다.";
      } finally {
        if (selection === epoch) decoding.value = false;
      }
    },
    { immediate: true },
  );
  /**
   * 화면이 닫히면 해석 결과의 소유권을 해제하고 Object URL을 반납한다. 이후 완료되는 Promise가 사라진 화면을 갱신하지 못하게 한다.
   */
  onBeforeUnmount(() => {
    selection++;
    decoder.dispose();
  });
  return {
    image,
    loading: computed(() => query.isFetching.value || decoding.value),
    error: computed(() => query.error.value?.message ?? decodeError.value),
    retry: () => query.refetch(),
  };
}
