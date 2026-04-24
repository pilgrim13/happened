# 보고 채널 검토

## 목표

터미널을 직접 읽지 않아도 Happened의 진행 상황, 기획 문서, 디자인 프로토타입 파일을 확인할 수 있는 외부 보고 채널을 마련한다.

## Discord 가능 여부

Discord는 가벼운 진행 보고 채널로 가능하다.

가장 단순한 방식은 비공개 Discord 채널에 Incoming Webhook을 만들고, 로컬 스크립트가 그 웹훅으로 보고를 보내는 구조다. 이 방식이면 다음을 보낼 수 있다.

- 짧은 진행 요약.
- Markdown 문서 파일.
- SVG, PNG, JPEG 디자인 프로토타입 이미지.
- 파일이 큰 경우 로컬/호스팅 링크.

Discord 공식 Webhook API는 봇 유저 없이 채널에 메시지를 게시할 수 있고, webhook 실행 요청은 메시지 본문, embed, multipart form-data 파일 첨부를 지원한다.

- https://docs.discord.com/developers/resources/webhook

## 필요한 것

- 비공개 Discord 서버 또는 채널.
- 사용자가 직접 생성한 Discord Incoming Webhook URL.
- 웹훅 URL을 git 밖에 저장할 `.env.local`.
- `docs/` 파일을 읽어 Discord로 전송하는 로컬 스크립트.

예상 명령:

```bash
npm run report:discord
```

전송 후보:

- `docs/product-brief.md`
- `docs/design-prototype.md`
- `docs/prototypes/happened-major-screens.svg`

## 결정 경계

Discord 웹훅 생성, 웹훅 URL 저장, 자동 보고 채널 구성은 외부 연동이므로 사용자 승인이 필요하다. 지금 단계에서는 가능성 검토와 설계까지만 한다.

웹훅 URL을 받으면 구현 자체는 어렵지 않다. URL은 비밀값이므로 절대 git에 커밋하지 않는다.

## 한계와 리스크

- Discord 메시지 본문은 길이 제한이 있으므로 긴 문서는 첨부 파일 또는 요약 형태가 낫다.
- 파일 크기 제한은 계정/서버 정책에 따라 달라질 수 있으므로 큰 영상이나 고해상도 이미지는 압축하거나 링크로 보내는 편이 안전하다.
- Discord는 빠른 리뷰에는 좋지만, 영구적인 제품 문서 저장소로는 부족하다.
- 웹훅 URL이 유출되면 해당 채널에 외부 메시지를 보낼 수 있으므로 비밀 관리가 필요하다.

## GitHub 보고 방식

SSH로 맥미니를 쓰는 환경에서는 GitHub 저장소에 보고 디렉터리를 두는 방식이 가장 단순하다.

추천 구조:

```text
reports/
  README.md
  001-project-brief/
    report.md
  002-home-ui-prototype/
    report.md
    assets/
      home-feed.png
```

장점:

- 브라우저나 모바일 GitHub 앱에서 바로 확인할 수 있다.
- 보고서, 이미지, 코드 변경이 같은 히스토리에 남는다.
- Discord 웹훅보다 초기 설정이 적다.
- SSH 환경에서도 스크린샷 파일을 커밋하면 원격에서 확인 가능하다.

파일 크기 기준:

- Markdown과 SVG는 GitHub 보고에 적합하다.
- PNG/JPEG는 압축해서 커밋한다.
- 개별 이미지 파일은 가능하면 10MB 이하로 유지한다.
- 일반 보고 폴더는 가능하면 25MB 이하로 유지한다.
- 큰 영상, 앱 빌드 파일, 원본 녹화 파일, 아카이브는 커밋하지 않는다.
- 큰 산출물은 필요할 때 별도 저장소나 릴리즈, 외부 스토리지 여부를 승인받고 결정한다.

## 추천안

- 단기: GitHub 저장소의 `reports/` 디렉터리에 보고서를 누적한다.
- 기준 문서: `docs/`와 git을 계속 원본으로 둔다.
- 큰 이미지/영상: 압축본만 커밋하고 원본은 승인 전까지 외부에 올리지 않는다.
- 선택 옵션: Discord 웹훅은 나중에 GitHub 보고 링크를 알림으로 보내는 보조 채널로 쓴다.
- 향후: 저장소 호스팅을 정하면 GitHub Issues/Projects를 작업 추적 채널로 쓴다.
- 문서 중심 리뷰가 필요해지면 Notion 또는 Google Drive를 검토한다.
