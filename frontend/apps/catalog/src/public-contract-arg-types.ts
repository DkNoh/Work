/*
 * compiled UI 패키지의 공개 계약 JSON을 Storybook Docs/Controls 표로 연결하는 adapter다. UI 소스 import 없이 문서와 실제 패키지 소비를 연결한다.
 *  PublicContract는 JSON의 모양, StrictArgTypes는 Storybook이 기대하는 모양이다. Map은 컴포넌트 이름으로 계약을 빠르게 찾는다.
 *  이 모듈은 표시용 metadata만 만들며 Story args 값이나 이벤트 처리·UI 동작을 변경하지 않는다.
 */
import type { StrictArgTypes, StrictInputType } from "storybook/internal/types";
import contracts from "../../../../docs/ui-contracts.json";

type PublicMember = { name: string; type: string; description: string };
type PublicProp = PublicMember & {
  required: boolean;
  defaultSpecified: boolean;
  default: unknown;
};
type PublicContract = {
  component: string;
  props: PublicProp[];
  events: PublicMember[];
  slots: PublicMember[];
};

const publicContracts: ReadonlyMap<string, PublicContract> = new Map(
  contracts.components.map((contract) => [contract.component, contract]),
);

// 공개 union 선택지는 Story가 명시한 options만 사용한다. scalar는 알맞은 입력을, 함수/HTMLImageElement는 편집 불가 Controls를 제공한다.
function propControl(
  prop: PublicProp,
  initialValue: unknown,
  inferred?: StrictInputType,
): StrictInputType {
  // CSF가 공개 union의 선택지를 명시한 경우 Controls도 같은 규격을 선택하게 한다.
  if (Array.isArray(inferred?.options) && inferred.options.length) {
    return {
      ...inferred,
      name: prop.name,
      type: { name: "other", value: prop.type, required: prop.required },
      control: { type: "select", disable: false },
    };
  }
  const definedType = prop.type.replace(/\s*\|\s*(undefined|null)\b/g, "").trim();
  const scalar = ["boolean", "number", "string"].find((type) => type === definedType);
  if (scalar === "boolean" || scalar === "number" || scalar === "string") {
    return {
      name: prop.name,
      type: { name: scalar, required: prop.required },
      control: { type: scalar === "string" ? "text" : scalar, disable: false },
    };
  }
  if (prop.type.includes("=>") || prop.type.includes("HTMLImageElement")) {
    return {
      name: prop.name,
      type: { name: "other", value: prop.type, required: prop.required },
      control: { disable: true },
    };
  }
  // 별칭·union의 선택지를 임의로 만들지 않는다. 실제 args의 scalar/JSON을 편집한다.
  const value =
    initialValue !== undefined
      ? initialValue
      : prop.defaultSpecified && prop.default !== "undefined"
        ? prop.default
        : undefined;
  const primitive = typeof value;
  if (primitive === "string" || primitive === "number" || primitive === "boolean") {
    return {
      name: prop.name,
      type: { name: primitive, required: prop.required },
      control: { type: primitive === "string" ? "text" : primitive, disable: false },
    };
  }
  // enhancer는 CSF 초기 정규화 뒤 실행되므로 shorthand가 아닌 control.type을 제공한다.
  const control =
    typeof inferred?.control === "string"
      ? { type: inferred.control, disable: false }
      : inferred?.control && typeof inferred.control === "object"
        ? inferred.control
        : { type: "object" as const, disable: false };
  return {
    ...inferred,
    name: prop.name,
    type: { ...(inferred?.type ?? { name: "other", value: prop.type }), required: prop.required },
    control,
  };
}

// description/type/default를 문서 표에 채운다. 기본값 표시와 실제 args 주입은 다른 책임이므로 여기서는 실행 값을 바꾸지 않는다.
function documentedProp(
  prop: PublicProp,
  initialValue: unknown,
  inferred?: StrictInputType,
): StrictInputType {
  return {
    ...propControl(prop, initialValue, inferred),
    description: prop.description,
    table: {
      category: "props",
      type: { summary: prop.type },
      // 미기재와 명시 null은 서로 다른 계약이며 args 기본값으로 주입하지 않는다.
      defaultValue: prop.defaultSpecified
        ? {
            summary: prop.default === "undefined" ? "undefined" : JSON.stringify(prop.default),
          }
        : undefined,
    },
  };
}

// CSF title 끝의 공개 컴포넌트 이름으로 계약을 찾는다. 일치하지 않는 합성 Story는 원래 추론 결과를 유지한다.
export function publicContractArgTypes(
  title: string,
  inferred: StrictArgTypes,
  initialArgs: Readonly<Record<string, unknown>>,
): StrictArgTypes {
  const contract = publicContracts.get(title.split("/").at(-1) ?? "");
  if (!contract) return inferred;

  // compiled 공개 컴포넌트에는 SFC docgen 정보가 없으므로 생성된 공개 계약을 연결한다.
  // UI source/private import, fixture props, 실제 args와 이벤트 처리에는 관여하지 않는다.
  const definitions: StrictArgTypes = Object.fromEntries(
    contract.props.map((prop) => [
      prop.name,
      documentedProp(prop, initialArgs[prop.name], inferred[prop.name]),
    ]),
  );
  for (const category of ["events", "slots"] as const) {
    for (const member of contract[category]) {
      // error/loading 같은 prop과 동명 slot도 별도 행으로 유지한다.
      definitions[`${category}:${member.name}`] = {
        name: member.name,
        description: member.description,
        type: { name: "other", value: member.type },
        table: { category, type: { summary: member.type } },
        control: { disable: true },
      };
    }
  }
  return definitions;
}
