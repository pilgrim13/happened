# Happened Reports

이 디렉터리는 GitHub에서 확인할 수 있는 오너 보고서 저장소다.

## 폴더 규칙

보고 폴더는 날짜와 번호를 함께 쓴다.

```text
YYMMDD-001-project-brief/
YYMMDD-002-home-ui-prototype/
YYMMDD-003-auth-flow/
```

예시:

```text
260424-001-project-brief/
```

## 보고서 구조

각 보고서는 다음 구조를 기본으로 한다.

```text
reports/
  260424-001-project-brief/
    report.md
    assets/
      happened-major-screens.svg
```

## GitHub 이미지/파일 기준

- Markdown과 SVG를 우선 사용한다. GitHub에서 바로 읽기 쉽고 파일이 작다.
- 스크린샷은 압축 PNG/JPEG로 저장한다.
- 개별 이미지 파일은 가능하면 10MB 이하로 유지한다.
- 보고 폴더 하나는 가능하면 25MB 이하로 유지한다.
- 원본 녹화 영상, 앱 빌드 파일, `.ipa`, `.apk`, `.aab`, 대용량 zip은 커밋하지 않는다.
- 큰 파일이 필요하면 별도 저장 방식은 승인받고 결정한다.

## 현재 보고

- [Report #1: MVP 기획서와 디자인 프로토타입](260424-001-project-brief/report.md)
- [Report #2: 아날로그 필름 감성 반영](260424-002-analog-film-design-feedback/report.md)
- [Report #3: 아날로그 필름 무드 재작업](260424-003-stronger-analog-film-direction/report.md)
- [Report #4: 실제 앱 렌더 스크린샷](260424-004-actual-app-screenshots/report.md)
