/** 앱별 인스턴스가 공유해 읽는 기본 문구. locale 선택 상태는 포함하지 않는다. */
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
