import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getLocales } from 'expo-localization';
import { Platform } from 'react-native';

import type { FeedMode, Visibility } from '../types/happened';

export type LanguageCode = 'ko' | 'en';

const LANGUAGE_STORAGE_KEY = 'happened-language';

const translations = {
  en: {
    'app.ready': 'Happened is ready',
    'app.readyAt': 'Ready to verify {{placeName}}',
    'app.locationUpdated': 'Location updated · {{accuracy}}m accuracy',
    'app.locationUnavailable': 'Location permission is unavailable',
    'app.locationPermissionTitle': 'Location Permission Required',
    'app.locationPermissionMessage': 'Please allow location access in Settings to use this feature.',
    'app.openSettings': 'Open Settings',
    'app.checkInIssued': 'Place verified. You can post from here now.',
    'app.checkInFailed': 'Place verification failed',
    'app.noUploads': 'No posts remaining for this place verification',
    'app.invalidToken': 'Place verification expired. Verify the place again.',
    'app.memorySaved': 'Memory saved to {{placeName}}',
    'app.memoryUploadFailed': 'Memory upload failed',
    'app.shareOpened': 'Share sheet opened',
    'app.shareCopied': 'Share text copied',
    'app.shareUnavailable': 'Sharing is not available in this browser',
    'app.captureFindingLocation': 'Checking your current location...',
    'app.captureNeedsLocation': 'Allow location to verify that you are near this place.',
    'app.locationCaptured': 'Location captured. Place coordinates are pending.',
    'app.distanceFromPlace': '{{meters}}m from place · upload radius {{radius}}m',
    'app.noUploadablePlace': 'No registered place is close enough to post from here. Choose a place on the map or verify when you are near one.',
    'app.noUploadablePlaceShort': 'No postable place nearby.',
    'app.outsideUploadRadius': 'You are outside the {{radius}}m upload radius. Current distance is {{distance}}m.',

    'language.ko': '한국어',
    'language.en': 'English',
    'language.switchTo': '한국어',
    'common.back': 'Back',
    'common.continue': 'Continue',
    'common.open': 'Open',
    'common.locked': 'Locked',
    'common.loading': 'Loading',
    'common.required': 'Required',
    'common.edit': 'Edit',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.post': 'Post',
    'common.posts': 'Posts',
    'common.saved': 'Saved',
    'common.follow': 'Follow',
    'common.following': 'Following',
    'common.followers': 'Followers',
    'common.replies': 'Replies',
    'common.memories': 'Memories',
    'common.places': 'Places',
    'common.people': 'People',
    'common.safety': 'Safety',
    'common.guest': 'Guest',

    'tabs.home': 'Home',
    'tabs.map': 'Map',
    'tabs.capture': 'Capture',
    'tabs.timeline': 'Timeline',
    'tabs.profile': 'Profile',

    'welcome.subtitle': 'Friends, places, and memories that open when you are actually there.',
    'welcome.meta': 'Seolleung Station Cafe · 84m away',
    'welcome.placeBased': 'Place based',
    'welcome.previewTitle': 'Same corner table, years later.',
    'welcome.checkIn': 'Verify place',
    'welcome.create': 'Create account',
    'welcome.login': 'Log in',
    'welcome.benefit1Title': 'Real place context',
    'welcome.benefit1Text': 'Posts can be locked, nearby, or open by distance.',
    'welcome.benefit2Title': 'Private by default',
    'welcome.benefit2Text': 'Share with followers first, go public only when you choose.',
    'welcome.benefit3Title': 'Built for revisit moments',
    'welcome.benefit3Text': 'Old memories resurface when you return to the same place.',

    'tutorial.kicker': 'How Happened works',
    'tutorial.skip': 'Skip',
    'tutorial.start': 'Start Happened',
    'tutorial.placesTitle': 'Open memories where they happened',
    'tutorial.placesText': 'Nearby memories open around real places. Use the map or place cards to see what is available around you.',
    'tutorial.captureTitle': 'Verify the place and post a photo',
    'tutorial.captureText': 'When you are near a place, verify your location once, then take or choose a photo before posting the memory.',
    'tutorial.friendsTitle': 'Follow friends and revisit together',
    'tutorial.friendsText': 'Follow friends, reply to memories, save posts, and return to places to rediscover older moments.',

    'auth.create': 'Create account',
    'auth.login': 'Log in',
    'auth.registerTitle': 'Start with a test account',
    'auth.loginTitle': 'Return to an existing account',
    'auth.registerCopy': 'If this is your first time, tap Create account.',
    'auth.loginCopy': 'Welcome back. Sign in with the email you registered.',
    'auth.email': 'Email',
    'auth.name': 'Name',
    'auth.nickname': 'Nickname',
    'auth.password': 'Password',
    'auth.working': 'Working...',
    'auth.quick': 'Quick test account (coming soon)',
    'auth.loginExisting': 'Log in existing',
    'auth.createNew': 'Create new account',
    'auth.failed': 'Authentication failed.',
    'auth.incorrect': 'Existing account login failed. If this is your first time, tap Create account.',
    'auth.already': 'This email or nickname already exists. Use Log in for an existing account, or Quick test account for a new test account.',
    'auth.oauthDivider': 'or continue with',
    'auth.continueWithGoogle': 'Continue with Google (coming soon)',
    'auth.continueWithApple': 'Continue with Apple (coming soon)',
    'auth.oauthComingSoon': 'Social login is coming in the next sprint.',

    'permissions.kicker': 'Permissions',
    'permissions.title': 'For memories that open at places',
    'permissions.copy': 'Location is requested only when it helps you open or post place memories. Camera, photos, and notifications are requested later in context.',
    'permissions.location': 'Location',
    'permissions.locationCopy': 'Shows nearby memories and confirms you are close enough to post at a place.',
    'permissions.camera': 'Camera',
    'permissions.cameraCopy': 'Asked when you tap the camera to capture a memory.',
    'permissions.photos': 'Photos',
    'permissions.photosCopy': 'Asked when you choose an existing photo for a memory.',
    'permissions.notifications': 'Notifications',
    'permissions.notificationsCopy': 'Asked later if recall alerts are enabled.',
    'permissions.primaryLocation': 'Allow location',
    'permissions.secondarySkip': 'Continue without location',
    'permissions.later': 'Asked later',
    'permissions.allowed': 'Allowed',
    'permissions.retry': 'Try again',
    'permissions.locationBenefitTitle': 'Why location matters',
    'permissions.locationBenefitText': 'Happened uses location to open memories near you and to verify that a photo is posted from the real place. Your location is not shown on posts.',
    'permissions.webLocation': 'Web preview will continue with a development location.',
    'permissions.locationDenied': 'Allow Location in device settings.',
    'permissions.cameraDenied': 'Camera permission was not granted.',
    'permissions.notificationsDenied': 'Notifications were not enabled.',
    'permissions.notificationsWeb': 'Push notifications are unavailable on web. They will work in the native app.',
    'permissions.photosDenied': 'Photo access was not granted.',
    'permissions.requestFailed': 'Permission request failed.',

    'home.tagline': 'Location based memories',
    'home.searchPlaceholder': 'Search friends, places, captions',
    'home.searching': 'Searching...',
    'home.notifications': 'Notifications',
    'home.noNotifications': 'No notifications yet',
    'home.noPosts': 'No posts yet',
    'home.noSearch': 'No posts match this search.',
    'home.emptyFeed': 'Follow friends or verify a place to start seeing memories.',
    'home.noMemories': 'No memories yet',
    'home.noMemoriesText': 'Capture your first memory right where you are.',
    'home.goCapture': 'Take a photo',
    'home.postedAt': '{{authorName}} posted at {{placeName}}',
    'home.openNow': 'open now',
    'home.lockedByPlace': 'locked by place',
    'home.hide': 'Hide this post',
    'home.report': 'Report',
    'home.blockAuthor': 'Block {{handle}}',
    'home.editPost': 'Edit post',
    'home.editCaption': 'Edit caption...',
    'home.deletePost': 'Delete post',
    'home.deleteConfirmTitle': 'Delete this memory?',
    'home.deleteConfirmText': 'This cannot be undone.',
    'home.deleteConfirmAction': 'Delete',
    'home.echoOpen': 'Open now',
    'home.echoOpenMeta': 'You are close enough to view this memory',
    'home.echoNearby': 'Almost there',
    'home.echoNearbyMeta': 'Move closer to open the full memory',
    'home.echoLocked': 'Place locked',
    'home.echoLockedMeta': 'Return to this place to unlock the full post',
    'home.lockedTitle': 'Locked by place',
    'home.lockedText': 'Get within {{meters}}m to open the full memory.',
    'home.writeReply': 'Write a reply',
    'home.emptyReply': 'Reply is empty',
    'home.actionFailed': 'Action failed',
    'home.shareFailed': 'Share failed',
    'home.checkInAt': 'Verify at {{placeName}}',
    'home.refreshFailed': 'Feed refresh failed',
    'home.refreshed': 'Updated to latest',
    'home.noticeEcho': '{{actor}} echoed your memory',
    'home.noticeSave': '{{actor}} saved your memory',
    'home.noticeReply': '{{actor}} replied to your memory',
    'home.noticeFollow': '{{actor}} started following you',
    'home.distanceMeters': '{{meters}} m away',
    'home.distanceKm': '{{kilometers}} km away',
    'home.publicCountdown': 'Public in {{min}}m',

    'capture.kicker': 'Capture here',
    'capture.currentLocation': 'Current location',
    'capture.locationLoading': 'Detecting location...',
    'capture.noPlaceTitle': 'No postable place nearby',
    'capture.selectPlaceOnMap': 'Choose place on map',
    'capture.distanceMeters': '{{meters}}m',
    'capture.distanceUnknown': 'Checking',
    'capture.noPlacePill': 'No place',
    'capture.selected': 'Selected field memory',
    'capture.verified': 'Verified place capture',
    'capture.tokenActive': 'Place verified',
    'capture.tokenRequired': 'Verify this place before posting',
    'capture.tokenMeta': '{{expires}} left · {{uploads}} posts remaining',
    'capture.tokenDefault': 'We check that you are near this place before the photo is posted.',
    'capture.caption': 'Caption',
    'capture.defaultCaption': 'Saved from this place.',
    'capture.takePhoto': 'Tap to take a photo',
    'capture.addPhoto': 'Add media',
    'capture.photoReady': 'Media ready',
    'capture.photoRequired': 'Add a photo or video before posting.',
    'capture.photoFailed': 'Media failed',
    'capture.retake': 'Retake',
    'capture.removePhoto': 'Remove',
    'capture.postMemory': 'Post memory',
    'capture.checkIn': 'Verify place',
    'capture.verifyPlace': 'Verify place',
    'capture.placeNamePlaceholder': 'Leave blank to auto-fill with current address',
    'capture.locationRequired': 'Location permission is required',

    'map.gpsPending': 'GPS pending',
    'map.knownPlace': 'Known place',
    'map.checkIn': 'Can post',
    'map.live': 'Live map',
    'map.title': 'Nearby memories',
    'map.accuracy': '{{distance}} GPS accuracy',
    'map.locateHint': 'Tap locate to center on your current position.',
    'map.liveActive': 'Live distances active',
    'map.locationInactive': 'Location not active',
    'map.liveActiveText': 'Place rows now use your real GPS distance.',
    'map.locationInactiveText': 'Use the locate button to calculate open and posting states.',
    'map.memoryCount': '{{count}} memories',

    'timeline.kicker': 'Place timeline',
    'timeline.title': 'Stories accumulate by month',
    'timeline.recallTitle': '3 years ago at Seolleung Station Cafe',
    'timeline.recallMeta': 'Reopened because you are back within 200m.',

    'place.captureHere': 'Capture here',
    'place.roll': 'PLACE ROLL / 200M',
    'place.status': '{{open}} open · {{locked}} locked',
    'place.subtitle': 'Stories develop here when you return.',
    'place.unlockRule': 'Unlock rule',
    'place.unlockMeta': 'Full memories open within 200m. Posting requires one place verification near the location.',
    'place.monthly': 'Monthly timeline',
    'place.noRoll': 'No monthly roll yet',
    'place.noRollMeta': 'Capture at this place to start the first story strip.',

    'profile.defaultVisibility': 'Default visibility',
    'profile.editProfile': 'Edit profile',
    'profile.profileSaved': 'Profile updated',
    'profile.profileSaveFailed': 'Profile update failed',
    'profile.name': 'Name',
    'profile.handle': 'Nickname',
    'profile.bio': 'Bio',
    'profile.bioPlaceholder': 'A short intro for friends.',
    'profile.photo': 'Profile photo',
    'profile.photoMeta': 'Choose a square image',
    'profile.photoFailed': 'Profile photo failed',
    'profile.friends': 'Friends',
    'profile.myPosts': 'My posts',
    'profile.noMyPosts': 'No posts yet',
    'profile.postSaveFailed': 'Post update failed',
    'profile.postDeleteFailed': 'Post delete failed',
    'profile.noFollowers': 'No followers yet',
    'profile.noFollowing': 'Not following anyone yet',
    'profile.followersOnly': 'Public after 1 hour',
    'profile.defaultText': 'New memories start with friends, then become public after 1 hour unless you choose otherwise.',
    'profile.blocked': 'Blocked accounts',
    'profile.reports': 'Reports and hidden posts',
    'profile.notify': 'Revisit recall alerts',
    'profile.delete': 'Account deletion',
    'profile.on': 'On',
    'profile.byRequest': 'By request',
    'profile.signOut': 'Sign out',

    'post.loading': 'Loading post',
    'post.failed': 'Post failed to load',
    'post.deleteFailed': 'Delete failed',
    'post.deleted': 'Reply deleted',
    'post.noReplies': 'No replies yet',
    'post.noRepliesText': 'Start the conversation from this place memory.',
    'post.unlockedByComment': 'Photo unlocked by your comment 🎉',

    'user.loading': 'Loading profile',
    'user.failed': 'Profile failed to load',
    'user.followFailed': 'Follow failed',
    'user.block': 'Block',
    'user.unblock': 'Unblock',
    'user.blockFailed': 'Block failed',
    'user.blockedByYou': 'Blocked account',
    'user.blocksViewer': 'This account is unavailable',
    'user.noSaved': 'No saved posts',
    'user.noPosts': 'No posts yet',
    'user.noSavedText': 'Saved memories will appear here.',
    'user.noPostsText': 'This profile has not posted a memory yet.',

    'mode.Following': 'Following',
    'mode.Nearby': 'Nearby',
    'mode.Memories': 'Memories',
    'visibility.Followers': 'Followers',
    'visibility.PublicAfter1h': 'Public after 1h',
    'visibility.Public': 'Public now',
    'visibility.Public.label': 'Public',
    'visibility.Public.help': 'Anyone can see this',
    'visibility.Public.short': 'Public',
    'visibility.PublicAfter1h.label': 'Public after 1h',
    'visibility.PublicAfter1h.help': 'Followers only for the first hour',
    'visibility.PublicAfter1h.short': '1h',
    'visibility.Followers.label': 'Followers only',
    'visibility.Followers.help': 'Only your followers can see this',
    'visibility.Followers.short': 'Followers',
  },
  ko: {
    'app.ready': 'Happened 준비 완료',
    'app.readyAt': '{{placeName}} 현장 인증 준비 완료',
    'app.locationUpdated': '위치 업데이트 · 정확도 {{accuracy}}m',
    'app.locationUnavailable': '위치 권한을 사용할 수 없습니다',
    'app.locationPermissionTitle': '위치 권한이 필요합니다',
    'app.locationPermissionMessage': '이 기능을 사용하려면 설정에서 위치 접근을 허용해 주세요.',
    'app.openSettings': '설정 열기',
    'app.checkInIssued': '현장 인증 완료. 이제 이 장소에 게시할 수 있습니다',
    'app.checkInFailed': '현장 인증 실패',
    'app.noUploads': '이 현장 인증으로 남은 게시 가능 횟수가 없습니다',
    'app.invalidToken': '현장 인증이 만료되었습니다. 다시 인증하세요.',
    'app.memorySaved': '{{placeName}}에 기억을 저장했습니다',
    'app.memoryUploadFailed': '기억 업로드 실패',
    'app.shareOpened': '공유창을 열었습니다',
    'app.shareCopied': '공유 문구를 복사했습니다',
    'app.shareUnavailable': '이 브라우저에서는 공유를 사용할 수 없습니다',
    'app.captureFindingLocation': '현재 위치를 확인하는 중입니다.',
    'app.captureNeedsLocation': '이 장소 근처인지 확인하려면 위치 권한이 필요합니다.',
    'app.locationCaptured': '위치를 확인했습니다. 장소 좌표는 준비 중입니다.',
    'app.distanceFromPlace': '장소에서 {{meters}}m · 업로드 반경 {{radius}}m',
    'app.noUploadablePlace': '현재 위치 근처에 게시 가능한 등록 장소가 없습니다. 지도에서 장소를 선택하거나 실제 장소 근처에서 인증하세요.',
    'app.noUploadablePlaceShort': '근처에 게시 가능한 장소가 없습니다.',
    'app.outsideUploadRadius': '현재 위치가 업로드 반경({{radius}}m) 밖에 있습니다. 지금은 장소에서 {{distance}}m 떨어져 있습니다.',

    'language.ko': '한국어',
    'language.en': 'English',
    'language.switchTo': 'EN',
    'common.back': '뒤로',
    'common.continue': '계속',
    'common.open': '열림',
    'common.locked': '잠김',
    'common.loading': '불러오는 중',
    'common.required': '필수',
    'common.edit': '수정',
    'common.save': '저장',
    'common.cancel': '취소',
    'common.delete': '삭제',
    'common.post': '게시',
    'common.posts': '게시물',
    'common.saved': '저장됨',
    'common.follow': '팔로우',
    'common.following': '팔로잉',
    'common.followers': '팔로워',
    'common.replies': '댓글',
    'common.memories': '기억',
    'common.places': '장소',
    'common.people': '사람',
    'common.safety': '안전',
    'common.guest': '게스트',

    'tabs.home': '홈',
    'tabs.map': '지도',
    'tabs.capture': '촬영',
    'tabs.timeline': '타임라인',
    'tabs.profile': '프로필',

    'welcome.subtitle': '친구, 장소, 그리고 실제 그곳에 있을 때 열리는 기억.',
    'welcome.meta': '선릉역 카페 · 84m 거리',
    'welcome.placeBased': '장소 기반',
    'welcome.previewTitle': '몇 년 뒤, 같은 구석 테이블.',
    'welcome.checkIn': '현장 인증',
    'welcome.create': '계정 만들기',
    'welcome.login': '로그인',
    'welcome.benefit1Title': '실제 장소 맥락',
    'welcome.benefit1Text': '거리 조건에 따라 게시물이 잠김, 근처, 열림 상태로 바뀝니다.',
    'welcome.benefit2Title': '기본은 비공개',
    'welcome.benefit2Text': '먼저 팔로워에게 공유하고, 원할 때만 공개로 전환합니다.',
    'welcome.benefit3Title': '다시 방문하는 순간',
    'welcome.benefit3Text': '같은 장소로 돌아오면 오래된 기억이 다시 떠오릅니다.',

    'tutorial.kicker': 'Happened 사용법',
    'tutorial.skip': '건너뛰기',
    'tutorial.start': '시작하기',
    'tutorial.placesTitle': '기억은 실제 장소에서 열립니다',
    'tutorial.placesText': '근처 기억은 실제 장소 주변에서 열립니다. 지도나 장소 카드를 눌러 주변에 열린 기억을 확인하세요.',
    'tutorial.captureTitle': '현장 인증 후 사진 게시',
    'tutorial.captureText': '장소 근처에 있을 때 한 번 인증한 뒤, 사진을 촬영하거나 선택해서 기억을 게시합니다.',
    'tutorial.friendsTitle': '친구를 팔로우하고 다시 방문',
    'tutorial.friendsText': '친구를 팔로우하고, 댓글을 남기고, 게시물을 저장하세요. 같은 장소에 돌아오면 오래된 순간이 다시 열립니다.',

    'auth.create': '계정 만들기',
    'auth.login': '로그인',
    'auth.registerTitle': '테스트 계정으로 시작',
    'auth.loginTitle': '기존 계정으로 돌아오기',
    'auth.registerCopy': '처음이면 계정 만들기를 누르세요.',
    'auth.loginCopy': '가입한 이메일로 다시 로그인해 주세요.',
    'auth.email': '이메일',
    'auth.name': '이름',
    'auth.nickname': '닉네임',
    'auth.password': '비밀번호',
    'auth.working': '처리 중...',
    'auth.quick': '빠른 테스트 계정 (준비중)',
    'auth.loginExisting': '기존 계정 로그인',
    'auth.createNew': '새 계정 만들기',
    'auth.failed': '인증에 실패했습니다.',
    'auth.incorrect': '기존 계정 로그인에 실패했습니다. 처음이면 계정 만들기를 누르세요.',
    'auth.already': '이미 있는 이메일/닉네임입니다. 기존 계정이면 로그인, 새 테스트 계정이면 빠른 테스트 계정을 누르세요.',
    'auth.oauthDivider': '또는 다음으로 계속',
    'auth.continueWithGoogle': 'Google로 계속하기 (준비중)',
    'auth.continueWithApple': 'Apple로 계속하기 (준비중)',
    'auth.oauthComingSoon': '소셜 로그인은 다음 스프린트에서 연결됩니다.',

    'permissions.kicker': '권한',
    'permissions.title': '장소 기억을 위해',
    'permissions.copy': '위치는 근처 기억을 열거나 장소에 게시할 때만 요청합니다. 카메라, 사진, 알림은 필요한 순간에 따로 물어봅니다.',
    'permissions.location': '위치',
    'permissions.locationCopy': '내 주변 기억을 열고, 실제 장소 근처에서 게시하는지 확인합니다.',
    'permissions.camera': '카메라',
    'permissions.cameraCopy': '촬영 버튼을 누를 때 요청합니다.',
    'permissions.photos': '사진',
    'permissions.photosCopy': '기존 사진을 선택할 때 요청합니다.',
    'permissions.notifications': '알림',
    'permissions.notificationsCopy': '회상 알림을 켤 때 요청합니다.',
    'permissions.primaryLocation': '위치 허용하기',
    'permissions.secondarySkip': '위치 없이 시작',
    'permissions.later': '나중에 요청',
    'permissions.allowed': '허용됨',
    'permissions.retry': '다시 시도',
    'permissions.locationBenefitTitle': '왜 위치가 필요한가요?',
    'permissions.locationBenefitText': 'Happened는 내 주변 기억을 열고, 사진이 실제 장소에서 게시되는지 확인할 때 위치를 사용합니다. 내 위치가 게시물에 표시되지는 않습니다.',
    'permissions.webLocation': '웹 미리보기에서는 개발용 위치로 진행합니다.',
    'permissions.locationDenied': '기기 설정에서 위치를 허용하세요.',
    'permissions.cameraDenied': '카메라 권한이 허용되지 않았습니다.',
    'permissions.notificationsDenied': '알림이 켜지지 않았습니다.',
    'permissions.notificationsWeb': '웹에서는 푸시 알림을 켤 수 없습니다. 네이티브 앱에서 동작합니다.',
    'permissions.photosDenied': '사진 접근이 허용되지 않았습니다.',
    'permissions.requestFailed': '권한 요청에 실패했습니다.',

    'home.tagline': '장소 기반 기억',
    'home.searchPlaceholder': '친구, 장소, 글 검색',
    'home.searching': '검색 중...',
    'home.notifications': '알림',
    'home.noNotifications': '아직 알림이 없습니다',
    'home.noPosts': '아직 게시물이 없습니다',
    'home.noSearch': '검색 결과가 없습니다.',
    'home.emptyFeed': '친구를 팔로우하거나 장소를 현장 인증하면 기억이 보입니다.',
    'home.noMemories': '아직 추억이 없어요',
    'home.noMemoriesText': '지금 있는 곳에서 첫 추억을 남겨보세요',
    'home.goCapture': '촬영하러 가기',
    'home.postedAt': '{{authorName}}님이 {{placeName}}에 게시했습니다',
    'home.openNow': '지금 열림',
    'home.lockedByPlace': '장소 잠김',
    'home.hide': '이 게시물 숨기기',
    'home.report': '신고',
    'home.blockAuthor': '{{handle}} 차단',
    'home.editPost': '게시물 수정',
    'home.editCaption': '캡션 수정...',
    'home.deletePost': '게시물 삭제',
    'home.deleteConfirmTitle': '이 기억을 삭제할까요?',
    'home.deleteConfirmText': '되돌릴 수 없어요.',
    'home.deleteConfirmAction': '삭제',
    'home.echoOpen': '지금 열림',
    'home.echoOpenMeta': '이 기억을 볼 수 있을 만큼 가까이 있습니다',
    'home.echoNearby': '거의 도착',
    'home.echoNearbyMeta': '조금 더 가까이 가면 전체 기억이 열립니다',
    'home.echoLocked': '장소 잠김',
    'home.echoLockedMeta': '이 장소로 돌아오면 전체 게시물이 열립니다',
    'home.lockedTitle': '장소로 잠김',
    'home.lockedText': '{{meters}}m 안으로 들어오면 전체 기억이 열립니다.',
    'home.writeReply': '댓글 쓰기',
    'home.emptyReply': '댓글을 입력하세요',
    'home.actionFailed': '작업 실패',
    'home.shareFailed': '공유 실패',
    'home.checkInAt': '{{placeName}} 현장 인증',
    'home.refreshFailed': '피드 새로고침 실패',
    'home.refreshed': '최신 상태로 업데이트했어요',
    'home.noticeEcho': '{{actor}}님이 내 기억에 Echo를 남겼습니다',
    'home.noticeSave': '{{actor}}님이 내 기억을 저장했습니다',
    'home.noticeReply': '{{actor}}님이 내 기억에 댓글을 남겼습니다',
    'home.noticeFollow': '{{actor}}님이 나를 팔로우했습니다',
    'home.distanceMeters': '{{meters}}m 거리',
    'home.distanceKm': '{{kilometers}}km 거리',
    'home.publicCountdown': '공개까지 {{min}}분 남음',

    'capture.kicker': '여기서 촬영',
    'capture.currentLocation': '현재 위치 주변',
    'capture.locationLoading': '위치 확인 중...',
    'capture.noPlaceTitle': '게시 가능한 장소 없음',
    'capture.selectPlaceOnMap': '지도에서 장소 선택',
    'capture.distanceMeters': '{{meters}}m',
    'capture.distanceUnknown': '확인 중',
    'capture.noPlacePill': '장소 필요',
    'capture.selected': '선택한 현장 기억',
    'capture.verified': '현장 인증된 촬영',
    'capture.tokenActive': '현장 인증 완료',
    'capture.tokenRequired': '게시 전 현장 인증',
    'capture.tokenMeta': '{{expires}} 남음 · 게시 {{uploads}}회 가능',
    'capture.tokenDefault': '사진을 게시하기 전, 이 장소 근처에 있는지 한 번 확인합니다.',
    'capture.caption': '문구',
    'capture.defaultCaption': '이 장소에서 저장한 기억.',
    'capture.takePhoto': '눌러서 사진 촬영',
    'capture.addPhoto': '사진/동영상 추가',
    'capture.photoReady': '미디어가 준비되었습니다',
    'capture.photoRequired': '게시 전 사진이나 동영상을 추가하세요.',
    'capture.photoFailed': '미디어 처리 실패',
    'capture.retake': '다시 촬영',
    'capture.removePhoto': '삭제',
    'capture.postMemory': '기억 게시',
    'capture.checkIn': '현장 인증',
    'capture.verifyPlace': '현장 인증하기',
    'capture.placeNamePlaceholder': '비워두면 현재 위치 주소가 자동으로 들어가요',
    'capture.locationRequired': '위치 권한이 필요해요',

    'map.gpsPending': 'GPS 대기 중',
    'map.knownPlace': '알려진 장소',
    'map.checkIn': '게시 가능',
    'map.live': '실시간 지도',
    'map.title': '근처 기억',
    'map.accuracy': 'GPS 정확도 {{distance}}',
    'map.locateHint': '현재 위치로 이동하려면 위치 버튼을 누르세요.',
    'map.liveActive': '실시간 거리 활성화',
    'map.locationInactive': '위치 비활성화',
    'map.liveActiveText': '장소 목록이 실제 GPS 거리로 계산됩니다.',
    'map.locationInactiveText': '위치 버튼을 눌러 열림/게시 가능 상태를 계산하세요.',
    'map.memoryCount': '기억 {{count}}개',

    'timeline.kicker': '장소 타임라인',
    'timeline.title': '월별로 쌓이는 이야기',
    'timeline.recallTitle': '3년 전 선릉역 카페',
    'timeline.recallMeta': '200m 안으로 돌아와 다시 열렸습니다.',

    'place.captureHere': '여기서 촬영',
    'place.roll': '장소 롤 / 200M',
    'place.status': '{{open}}개 열림 · {{locked}}개 잠김',
    'place.subtitle': '돌아오면 이곳의 이야기가 이어집니다.',
    'place.unlockRule': '잠금 해제 규칙',
    'place.unlockMeta': '전체 기억은 200m 안에서 열립니다. 게시하려면 장소 근처에서 현장 인증이 필요합니다.',
    'place.monthly': '월별 타임라인',
    'place.noRoll': '아직 월별 롤이 없습니다',
    'place.noRollMeta': '이 장소에서 촬영하면 첫 이야기 스트립이 시작됩니다.',

    'profile.defaultVisibility': '기본 공개 범위',
    'profile.editProfile': '프로필 수정',
    'profile.profileSaved': '프로필을 수정했습니다',
    'profile.profileSaveFailed': '프로필 수정 실패',
    'profile.name': '이름',
    'profile.handle': '닉네임',
    'profile.bio': '소개',
    'profile.bioPlaceholder': '친구에게 보일 한 줄 소개',
    'profile.photo': '프로필 사진',
    'profile.photoMeta': '정사각형 이미지 권장',
    'profile.photoFailed': '프로필 사진 처리 실패',
    'profile.friends': '친구',
    'profile.myPosts': '내 게시물',
    'profile.noMyPosts': '아직 내 게시물이 없습니다',
    'profile.postSaveFailed': '게시물 수정 실패',
    'profile.postDeleteFailed': '게시물 삭제 실패',
    'profile.noFollowers': '아직 팔로워가 없습니다',
    'profile.noFollowing': '아직 팔로잉이 없습니다',
    'profile.followersOnly': '기본 1시간 뒤 공개',
    'profile.defaultText': '새 기억은 먼저 친구에게 보이고, 별도 선택이 없으면 1시간 뒤 공개됩니다.',
    'profile.blocked': '차단한 계정',
    'profile.reports': '신고 및 숨긴 게시물',
    'profile.notify': '재방문 회상 알림',
    'profile.delete': '계정 삭제',
    'profile.on': '켜짐',
    'profile.byRequest': '요청 시',
    'profile.signOut': '로그아웃',

    'post.loading': '게시물 불러오는 중',
    'post.failed': '게시물을 불러오지 못했습니다',
    'post.deleteFailed': '삭제 실패',
    'post.deleted': '댓글을 삭제했습니다',
    'post.noReplies': '아직 댓글이 없습니다',
    'post.noRepliesText': '이 장소 기억에 첫 댓글을 남겨보세요.',
    'post.unlockedByComment': '댓글로 사진이 공개됐어요 🎉',

    'user.loading': '프로필 불러오는 중',
    'user.failed': '프로필을 불러오지 못했습니다',
    'user.followFailed': '팔로우 실패',
    'user.block': '차단',
    'user.unblock': '차단 해제',
    'user.blockFailed': '차단 실패',
    'user.blockedByYou': '차단한 계정',
    'user.blocksViewer': '이 계정은 볼 수 없습니다',
    'user.noSaved': '저장한 게시물이 없습니다',
    'user.noPosts': '아직 게시물이 없습니다',
    'user.noSavedText': '저장한 기억이 여기에 표시됩니다.',
    'user.noPostsText': '이 프로필은 아직 기억을 게시하지 않았습니다.',

    'mode.Following': '팔로잉',
    'mode.Nearby': '근처',
    'mode.Memories': '기억',
    'visibility.Followers': '팔로워',
    'visibility.PublicAfter1h': '1시간 뒤 공개',
    'visibility.Public': '바로 공개',
    'visibility.Public.label': '전체 공개',
    'visibility.Public.help': '누구나 볼 수 있어요',
    'visibility.Public.short': '공개',
    'visibility.PublicAfter1h.label': '1시간 뒤 공개',
    'visibility.PublicAfter1h.help': '1시간 동안은 팔로워만 볼 수 있어요',
    'visibility.PublicAfter1h.short': '1h',
    'visibility.Followers.label': '팔로워만',
    'visibility.Followers.help': '팔로워에게만 보여요',
    'visibility.Followers.short': '팔로워',
  },
} as const;

type TranslationKey = keyof typeof translations.en;

type I18nContextValue = {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function readInitialLanguage(): LanguageCode {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return 'ko';
  }

  const params = new URLSearchParams(window.location.search);
  const queryLang = params.get('lang');

  if (queryLang === 'ko' || queryLang === 'en') {
    return queryLang;
  }

  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored === 'ko' || stored === 'en') {
    return stored;
  }

  const deviceLocale = getLocales()[0]?.languageCode ?? 'ko';
  return deviceLocale.startsWith('en') ? 'en' : 'ko';
}

function interpolate(template: string, values?: Record<string, string | number>) {
  if (!values) {
    return template;
  }

  return Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{{${key}}}`, String(value)), template);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(() => readInitialLanguage());

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<I18nContextValue>(() => {
    const setLanguage = (nextLanguage: LanguageCode) => setLanguageState(nextLanguage);

    return {
      language,
      setLanguage,
      toggleLanguage: () => setLanguageState((current) => (current === 'ko' ? 'en' : 'ko')),
      t: (key, values) => interpolate(translations[language][key] ?? translations.en[key], values),
    };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider.');
  }

  return context;
}

export function translateFeedMode(mode: FeedMode, t: I18nContextValue['t']) {
  return t(`mode.${mode}` as TranslationKey);
}

export function translateVisibility(visibility: Visibility, t: I18nContextValue['t']) {
  return t(`visibility.${visibility}` as TranslationKey);
}

const koreanPlaceNames: Record<string, string> = {
  'Seolleung Station Cafe': '선릉역 카페',
  'Gangnam Office': '강남 오피스',
  'Corner Cafe': '코너 카페',
  'Daechi School Yard': '대치 학교 운동장',
  'Han River Steps': '한강 계단',
  'Hongdae Alley Stage': '홍대 골목 스테이지',
};

export function localizePlaceName(placeName: string, language: LanguageCode) {
  if (language !== 'ko') {
    return placeName;
  }

  return koreanPlaceNames[placeName] ?? placeName;
}

export function translateServerMessage(message: string, language: LanguageCode) {
  if (language === 'en') {
    return message;
  }

  const outsideRadius = message.match(/^Current distance is (\d+)m, outside the (\d+)m upload radius\.$/);
  if (outsideRadius) {
    return `현재 위치가 업로드 반경(${outsideRadius[2]}m) 밖에 있습니다. 지금은 장소에서 ${outsideRadius[1]}m 떨어져 있습니다.`;
  }

  const lowAccuracy = message.match(/^Location accuracy is (\d+)m; check-in requires (\d+)m or better\.$/);
  if (lowAccuracy) {
    return `현재 위치 정확도가 ${lowAccuracy[1]}m입니다. 현장 인증에는 ${lowAccuracy[2]}m 이하의 정확도가 필요합니다.`;
  }

  if (message === 'Echo saved') {
    return 'Echo 저장됨';
  }
  if (message === 'Echo removed') {
    return 'Echo 취소됨';
  }
  if (message === 'Saved to your roll') {
    return '내 롤에 저장했습니다';
  }
  if (message === 'Removed from saved') {
    return '저장을 취소했습니다';
  }
  if (message === 'Reply posted') {
    return '댓글을 게시했습니다';
  }
  if (message === 'Post hidden from this session') {
    return '이 세션에서 게시물을 숨겼습니다';
  }
  if (message === 'Report saved for review') {
    return '검토용 신고가 저장되었습니다';
  }
  if (message === 'Profile updated') {
    return '프로필을 수정했습니다';
  }
  if (message === 'Post updated') {
    return '게시물을 수정했습니다';
  }
  if (message === 'Post deleted') {
    return '게시물을 삭제했습니다';
  }
  if (message.startsWith('Following ')) {
    return `${message.replace('Following ', '')}님을 팔로우했습니다`;
  }
  if (message.startsWith('Unfollowed ')) {
    return `${message.replace('Unfollowed ', '')}님 팔로우를 취소했습니다`;
  }
  if (message.startsWith('Blocked ')) {
    return `${message.replace('Blocked ', '')}님을 차단했습니다`;
  }
  if (message.startsWith('Unblocked ')) {
    return `${message.replace('Unblocked ', '')}님 차단을 해제했습니다`;
  }

  return message;
}

export function localizeTimeLabel(label: string, language: LanguageCode) {
  if (language === 'en') {
    return label;
  }

  if (label === 'just now') {
    return '방금';
  }
  if (label === '3 years ago') {
    return '3년 전';
  }
  if (label === 'last autumn') {
    return '지난 가을';
  }
  if (label === 'May 2019') {
    return '2019년 5월';
  }
  if (label === 'Feb 12') {
    return '2월 12일';
  }

  return label;
}

export function localizeRecallLabel(label: string | undefined, language: LanguageCode) {
  if (!label || language === 'en') {
    return label;
  }

  if (label === 'Saved at this place') {
    return '이 장소에 저장됨';
  }
  if (label === '3 years ago at this place') {
    return '3년 전 이 장소에서';
  }

  return label;
}
