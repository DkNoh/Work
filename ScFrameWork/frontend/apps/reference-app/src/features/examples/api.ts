import type { ApiComponents, FrameworkRuntime } from "@sc/runtime";
import type { ExampleInput } from "./schema";

export type ExampleEntry = ApiComponents["schemas"]["ExampleDto"];
export type ExamplePage = ApiComponents["schemas"]["ExamplePage"];

export function createExamplesApi(runtime: FrameworkRuntime) {
  return {
    list: (page: number, signal?: AbortSignal) =>
      runtime.client.request<ExamplePage>(`/examples?page=${page}&size=20`, "GET", undefined, {
        signal,
      }),
    create: (input: ExampleInput) =>
      runtime.client.request<ExampleEntry>("/examples", "POST", input),
    save: (id: number, input: ExampleInput, revision: number) =>
      runtime.client.request<ExampleEntry>(`/examples/${id}`, "PUT", { ...input, revision }),
  };
}
