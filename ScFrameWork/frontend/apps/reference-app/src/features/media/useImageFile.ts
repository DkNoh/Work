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
