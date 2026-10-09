/** 앱별 인스턴스가 공유해 읽는 기본 문구. locale 선택 상태는 포함하지 않는다. */
// ko/en 아래 같은 common.* 키를 유지하면 화면은 문구 자체 대신 common.actions.save 등으로 찾는다.
// 업무 도메인의 문구는 소비 앱이 options.messages로 추가하고, 이 파일은 중립 UI 문구를 제공한다.
// 마지막 as const는 문자열을 리터럴 타입으로, 속성을 readonly로 추론한다. 런타임 동결은 아니며
// 실제 앱 생성 시 mergeMessages가 별도 트리로 복사한다.
export const commonMessages = {
  ko: {
    common: {
      actions: {
        save: "저장",
        cancel: "취소",
        reset: "초기화",
        retry: "다시 시도",
        download: "다운로드",
        upload: "업로드",
      },
      shell: {
        skipToContent: "본문으로 이동",
        openNavigation: "메뉴 열기",
        closeNavigation: "메뉴 닫기",
      },
      states: {
        loading: "불러오는 중",
        empty: "표시할 자료가 없습니다.",
        error: "자료를 불러오지 못했습니다.",
      },
      chart: { dataTitle: "차트 데이터", noData: "표시할 데이터가 없습니다." },
      editor: {
        bold: "굵게",
        italic: "기울임",
        bulletList: "글머리 기호",
        undo: "실행 취소",
        redo: "다시 실행",
      },
      excel: { export: "Excel 내보내기", import: "Excel 가져오기" },
    },
  },
  en: {
    common: {
      actions: {
        save: "Save",
        cancel: "Cancel",
        reset: "Reset",
        retry: "Retry",
        download: "Download",
        upload: "Upload",
      },
      shell: {
        skipToContent: "Skip to content",
        openNavigation: "Open navigation",
        closeNavigation: "Close navigation",
      },
      states: { loading: "Loading", empty: "No items to display.", error: "Unable to load items." },
      chart: { dataTitle: "Chart data", noData: "No data to display." },
      editor: {
        bold: "Bold",
        italic: "Italic",
        bulletList: "Bullet list",
        undo: "Undo",
        redo: "Redo",
      },
      excel: { export: "Export Excel", import: "Import Excel" },
    },
  },
} as const;
