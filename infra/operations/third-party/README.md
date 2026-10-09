# 운영 이미지 upstream 고지 원문

이 디렉터리는 012에서 실제 사용하는 6개 서비스의 정확한 upstream version tag에서 받은 LICENSE·NOTICE 계열 파일을 원문 bytes로 보존한다. 제품 source를 patch하거나 고지 내용을 편집하지 않았다. 자체 추가물은 이 README와 inventory.json이며 각 파일에 원문 URL·Git blob SHA·SHA-256·길이가 기록돼 있다.

이 목록은 upstream repository root의 고지 11개를 보존한 것이다. 컨테이너 OS 패키지·모든 전이 구성품·Node/Temurin base image의 완전한 SBOM 또는 법률 결론은 포함하지 않는다. npm compiled library 고지는 frontend/packages/*/THIRD_PARTY_NOTICES에서 별도로 관리한다. Yzen 자료는 사용하지 않았다.

## 실제 버전과 라이선스

| 제품       | upstream 태그 | 원문에 따른 라이선스           | LICENSE/NOTICE 파일                                                                                                                                  |
| ---------- | ------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| rabbitmq   | `v4.3.6`      | MPL-2.0; component Apache-2.0  | [LICENSE](rabbitmq/v4.3.6/LICENSE), [LICENSE-APACHE2](rabbitmq/v4.3.6/LICENSE-APACHE2), [LICENSE-MPL-RabbitMQ](rabbitmq/v4.3.6/LICENSE-MPL-RabbitMQ) |
| prometheus | `v3.13.4`     | Apache-2.0                     | [LICENSE](prometheus/v3.13.4/LICENSE), [NOTICE](prometheus/v3.13.4/NOTICE)                                                                           |
| grafana    | `v13.2.3`     | AGPLv3 (upstream root LICENSE) | [LICENSE](grafana/v13.2.3/LICENSE), [NOTICE.md](grafana/v13.2.3/NOTICE.md)                                                                           |
| collector  | `v0.162.0`    | Apache-2.0                     | [LICENSE](collector/v0.162.0/LICENSE), [NOTICE](collector/v0.162.0/NOTICE)                                                                           |
| tempo      | `v3.1.0`      | AGPLv3 (upstream root LICENSE) | [LICENSE](tempo/v3.1.0/LICENSE)                                                                                                                      |
| loki       | `v3.7.8`      | AGPLv3 (upstream root LICENSE) | [LICENSE](loki/v3.7.8/LICENSE)                                                                                                                       |

RabbitMQ root LICENSE는 서버/core plugin MPL 2.0과 일부 OCF 파일 Apache 2.0을 구분하며 원문 파일 3개를 함께 보존한다. Tempo·Loki root에 별도 NOTICE가 없다는 API 목록 확인은 inventory의 rootNoticePresent=false로 기록했다. upstream에 없는 NOTICE를 생성하지 않았다. AGPLv3 표시는 받은 LICENSE 원문 기준이며 SPDX only/or-later 분류를 새로 단정하지 않는다.

## 원문 SHA-256와 출처

| 로컬 원문                                                                    | SHA-256                                                            | upstream 공식 version-tag URL                                                                             |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| [rabbitmq/v4.3.6/LICENSE](rabbitmq/v4.3.6/LICENSE)                           | `02a4e44df118d5ff8cd873463f4e4828833261e5e2678b87871515286a8de0f0` | [원문](https://raw.githubusercontent.com/rabbitmq/rabbitmq-server/v4.3.6/LICENSE)                         |
| [rabbitmq/v4.3.6/LICENSE-APACHE2](rabbitmq/v4.3.6/LICENSE-APACHE2)           | `983bf16ee19b54bef36cfd733dd2dc1b4c62441cbc435d10cf9a54e0ee68c96c` | [원문](https://raw.githubusercontent.com/rabbitmq/rabbitmq-server/v4.3.6/LICENSE-APACHE2)                 |
| [rabbitmq/v4.3.6/LICENSE-MPL-RabbitMQ](rabbitmq/v4.3.6/LICENSE-MPL-RabbitMQ) | `fab3dd6bdab226f1c08630b1dd917e11fcb4ec5e1e020e2c16f83a0a13863e85` | [원문](https://raw.githubusercontent.com/rabbitmq/rabbitmq-server/v4.3.6/LICENSE-MPL-RabbitMQ)            |
| [prometheus/v3.13.4/LICENSE](prometheus/v3.13.4/LICENSE)                     | `c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4` | [원문](https://raw.githubusercontent.com/prometheus/prometheus/v3.13.4/LICENSE)                           |
| [prometheus/v3.13.4/NOTICE](prometheus/v3.13.4/NOTICE)                       | `ac9e304462a58a4d71b6488423d4447e614c8b31d517fe24345016522c102a78` | [원문](https://raw.githubusercontent.com/prometheus/prometheus/v3.13.4/NOTICE)                            |
| [grafana/v13.2.3/LICENSE](grafana/v13.2.3/LICENSE)                           | `0d96a4ff68ad6d4b6f1f30f713b18d5184912ba8dd389f86aa7710db079abcb0` | [원문](https://raw.githubusercontent.com/grafana/grafana/v13.2.3/LICENSE)                                 |
| [grafana/v13.2.3/NOTICE.md](grafana/v13.2.3/NOTICE.md)                       | `78cf8b70fbfde43dbc26e91f9b9039b52afcbc5ca0b5b3dcdfb226d275849ee4` | [원문](https://raw.githubusercontent.com/grafana/grafana/v13.2.3/NOTICE.md)                               |
| [collector/v0.162.0/LICENSE](collector/v0.162.0/LICENSE)                     | `c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4` | [원문](https://raw.githubusercontent.com/open-telemetry/opentelemetry-collector-contrib/v0.162.0/LICENSE) |
| [collector/v0.162.0/NOTICE](collector/v0.162.0/NOTICE)                       | `6d7a5113049e69b6068c8304f4b2b67be17ae4a4679e1534539481cdcfda3dd9` | [원문](https://raw.githubusercontent.com/open-telemetry/opentelemetry-collector-contrib/v0.162.0/NOTICE)  |
| [tempo/v3.1.0/LICENSE](tempo/v3.1.0/LICENSE)                                 | `0d96a4ff68ad6d4b6f1f30f713b18d5184912ba8dd389f86aa7710db079abcb0` | [원문](https://raw.githubusercontent.com/grafana/tempo/v3.1.0/LICENSE)                                    |
| [loki/v3.7.8/LICENSE](loki/v3.7.8/LICENSE)                                   | `0d96a4ff68ad6d4b6f1f30f713b18d5184912ba8dd389f86aa7710db079abcb0` | [원문](https://raw.githubusercontent.com/grafana/loki/v3.7.8/LICENSE)                                     |

6개 이미지의 immutable digest와 Linux arm64 actual pull은 [012-images-pulled-second.json](../../../docs/검증/012-images-pulled-second.json), 파일·이미지 대응은 [inventory.json](inventory.json)을 기준으로 한다. 버전 변경 시 새 태그 디렉터리와 원문 hash를 추가하고 이전 버전 고지는 유지한다. 원문 LICENSE/NOTICE 파일에 formatter를 적용하지 않는다.

## 변경과 제공 범위 점검

- [x] 정확한 tag의 upstream LICENSE/NOTICE 원문 11개를 확보하고 URL·SHA-256·길이를 기록.
- [x] RabbitMQ의 Apache 구성품 및 Grafana NOTICE.md를 함께 보존.
- [x] 자체 작성 README/inventory와 upstream 원문을 구분.
- [ ] 실제 서비스 제공·이미지 재배포 형태에 따른 AGPL/MPL/Apache source·저작권·변경 고지 제공 범위를 검토.
- [ ] image OS/transitive SBOM 및 Node/Temurin base image까지 포함한 배포 권리 인벤토리 검토.

자체 변경은 Compose, private entrypoint, Collector 설정, Grafana provisioning/dashboard에 있다. upstream 6개 서비스 image binary/source는 patch하지 않았다. 이 구분만으로 재배포 조건 충족을 확정하지 않는다. [Grafana 공식 licensing 설명](https://grafana.com/licensing/)과 각 원문을 배포 형태에 맞춰 확인한다. 유료 Grafana Cloud·Enterprise 기능 및 외부 계정 API를 도입하지 않았다.
