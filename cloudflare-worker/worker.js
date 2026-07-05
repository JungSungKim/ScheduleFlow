/**
 * ScheduleFlow — Cloudflare Worker (캘린더 피드)
 *
 * 요청: GET /{uuid}.ics
 * 응답: Firestore publicCalendars/{uuid}에 저장된 ICS 내용 반환
 *
 * 배포:
 *   1. wrangler deploy  (또는 Cloudflare 대시보드에서 코드 붙여넣기)
 *   2. 배포 후 Worker URL을 ScheduleFlow 설정 > 캘린더 연동에 입력
 */

const FIREBASE_API_KEY = 'AIzaSyD2Cs6-UrVnMX3OhL5x6qb9zkcG5rD63B8';
const PROJECT_ID       = 'my-scheduleflow-dev';

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
        },
      });
    }

    // /{uuid}.ics 패턴만 허용
    const match = url.pathname.match(/^\/([0-9a-f-]{32,36})\.ics$/i);
    if (!match) {
      return new Response('Not Found', { status: 404 });
    }

    const token = match[1];
    const firestoreUrl =
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}` +
      `/databases/(default)/documents/publicCalendars/${token}` +
      `?key=${FIREBASE_API_KEY}`;

    const res = await fetch(firestoreUrl);
    if (!res.ok) {
      return new Response('Calendar not found', { status: 404 });
    }

    const doc = await res.json();
    const content = doc?.fields?.content?.stringValue;
    if (!content) {
      return new Response('Calendar not found', { status: 404 });
    }

    return new Response(content, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};
