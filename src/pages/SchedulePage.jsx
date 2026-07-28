import React from 'react';

import ScheduleManager from '../components/ScheduleManager';
import PageShell from './PageShell';

export default function SchedulePage() {
  return (
    <PageShell title="일정관리" description="마감 투두, 일정 알림, 체크 기록을 한 화면에서 관리합니다.">
      <ScheduleManager />
    </PageShell>
  );
}
