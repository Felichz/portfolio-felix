// LifeUI's Today screen: a day in progress with Write report running. The scene closes it with the
// closing ritual (9 out of 10, +78 tempos), then starts Read from a quick-start chip.
// The demo day is the one the README screenshots use (life-ui cypress/e2e/readme-screenshots.cy.ts).

/* eslint-disable */
function seed() {
  const q = window.__lifeui;
  const WinDate = window.Date;
  q.clearState();
  const template = (title, type, settings, pinned = false) =>
    q.createActivityTemplate({ title, description: '', type, isSystemActivity: false, pinned, ...settings });
  const report = template('Write report', 'clear-objective', { clearObjectiveSettings: { estimatedDurationMinutes: 45 } });
  const read = template('Read', 'timeboxing', { timeboxingSettings: { type: 'minimum-time', minimumDurationMinutes: 20 } }, true);
  const email = template('Check email', 'timeboxing', { timeboxingSettings: { type: 'maximum-time', maximumDurationMinutes: 15 } }, true);
  const tidy = template('Tidy up', 'flexible-duration', { flexibleDurationSettings: { minimumDurationMinutes: 5, maximumDurationMinutes: 10 } });
  const meditate = template('Meditate', 'timeboxing', { timeboxingSettings: { type: 'both', minimumDurationMinutes: 10, maximumDurationMinutes: 20 } }, true);
  const sprint = template('Plan the sprint', 'clear-objective', { clearObjectiveSettings: { estimatedDurationMinutes: 30 } });
  const workout = template('Workout', 'flexible-duration', { flexibleDurationSettings: { minimumDurationMinutes: 30, maximumDurationMinutes: 60 } });
  const coffee = q.createEventTemplate('Coffee');
  q.createEventTemplate('Ibuprofen');
  q.createTimeBlock('Morning', 360, 720);
  q.createTimeBlock('Afternoon', 720, 1080);
  q.createTimeBlock('Evening', 1080, 1380);
  const at = (daysAgo, hour, minute) => {
    const date = new WinDate();
    date.setDate(date.getDate() - daysAgo);
    date.setHours(hour, minute, 0, 0);
    return date;
  };
  const record = (dayId, t, start, duration, score, interrupted = false) => {
    const estimate = t.clearObjectiveSettings?.estimatedDurationMinutes;
    const end = new WinDate(start.getTime() + duration * 60000);
    return {
      id: crypto.randomUUID(), templateId: t.id, templateTitle: t.title,
      state: interrupted ? 'interrupted' : 'completed', type: t.type,
      clearObjectiveSettings: t.clearObjectiveSettings, flexibleDurationSettings: t.flexibleDurationSettings, timeboxingSettings: t.timeboxingSettings,
      startTime: start.toISOString(), endTime: end.toISOString(), durationMinutes: duration,
      satisfactionScore: interrupted ? 0 : score, temposAwarded: interrupted ? 0 : Math.ceil(((estimate || duration) * score) / 7),
      beatEstimate: false, dayId, createdAt: end.toISOString(),
    };
  };
  q.updateState((s) => {
    const history = [[0.9, 7], [1.2, 8], [0.6, 6], [1.4, 8], [1.0, 7], [0.5, 5], [1.1, 9], [1.3, 8], [0.8, 7], [1.2, 8], [0.7, 6], [1.0, 8]];
    history.forEach(([mult, score], index) => {
      const daysAgo = history.length - index;
      const dayId = crypto.randomUUID();
      s.global.days.push({ id: dayId, state: 'inactive', startTime: at(daysAgo, 8, 5).toISOString(), endTime: at(daysAgo, 22, 0).toISOString(), createdAt: at(daysAgo, 8, 5).toISOString(), updatedAt: at(daysAgo, 22, 0).toISOString() });
      [[meditate, 15, 8], [email, 12, 9], [report, Math.round(45 * mult), 10], [read, Math.round(25 * mult), 16], [workout, Math.round(40 * mult), 18]]
        .slice(0, 3 + Math.round(mult * 2))
        .forEach(([t, duration, hour]) => s.global.completedActivityRecords.push(record(dayId, t, at(daysAgo, hour, 10), duration, score)));
    });
    return s;
  });
  q.startDay();
  const day = q.getCurrentDay();
  const blocks = q.getTimeBlocks();
  const todo = blocks.find((b) => b.isDefault).id;
  const afternoon = blocks.find((b) => b.name === 'Afternoon').id;
  const evening = blocks.find((b) => b.name === 'Evening').id;
  q.updateState((s) => {
    const start = at(0, 8, 12).toISOString();
    s.currentDay.day.startTime = start;
    s.currentDay.day.createdAt = start;
    s.global.days = s.global.days.map((d) => (d.id === day.id ? { ...d, startTime: start, createdAt: start } : d));
    s.global.completedActivityRecords.push(
      record(day.id, meditate, at(0, 8, 30), 14, 7),
      record(day.id, email, at(0, 9, 0), 17, 5),
      record(day.id, report, at(0, 9, 40), 38, 8),
      record(day.id, tidy, at(0, 11, 15), 6, 4, true),
    );
    s.global.eventInstances.push({ id: crypto.randomUUID(), templateId: coffee.id, templateName: 'Coffee', timestamp: at(0, 9, 5).toISOString(), dayId: day.id, createdAt: at(0, 9, 5).toISOString() });
    return s;
  });
  q.createActivityInstance(sprint.id, todo);
  q.createActivityInstance(tidy.id, todo);
  q.createActivityInstance(workout.id, evening);
  q.createActivityInstance(read.id, evening);
  const running = q.createActivityInstance(report.id, afternoon, { clearObjectiveSettings: { estimatedDurationMinutes: 60 } });
  q.activateActivity(running.id);
  q.updateState((s) => {
    s.currentDay.activityInstances.find((x) => x.id === running.id).startTime = new WinDate(WinDate.now() - 23 * 60000 - 7000).toISOString();
    return s;
  });
}
/* eslint-enable */

export default {
  base: '/apps/lifeui/',
  spa: true,
  viewport: [1440, 900],
  clock: [15, 24],
  themeAttr: 'data-theme',
  readySelector: 'main h1',
  storage: ['qualia_control_app_state', 'lifeui.theme', 'lifeui.locale', 'lifeui.planView'],
  themeKey: 'lifeui.theme',

  async setup(page) {
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('lifeui.theme', 'light');
      localStorage.setItem('lifeui.locale', 'en');
    });
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForFunction(() => window.__lifeui);
    await page.evaluate(seed);
    await page.reload({ waitUntil: 'networkidle0' });
  },

  async run(s) {
    await s.checkpoint('start');
    await s.wait(900);
    // Close Write report with the ritual: 9 out of 10.
    await s.click('[data-testid=finish-active]');
    await s.wait(650);
    await s.click('[data-testid=closing-dialog] [role=radiogroup] button:nth-child(10)', { rest: 260 });
    await s.wait(420);
    await s.click('[data-testid=closing-confirm]');
    // Rest until the toast is gone, so this state can be thawed into the live app as is.
    await s.wait(5200);
    await s.checkpoint('closed');
    // Start Read from its quick-start chip.
    const read = await s.page.evaluateHandle(() =>
      [...document.querySelectorAll('section[aria-labelledby="quick-title"] button')].find((b) => b.textContent.trim().startsWith('Read')),
    );
    const box = await read.boundingBox();
    await s.moveTo(box.x + box.width / 2, box.y + box.height / 2);
    await s.wait(220);
    await s.page.mouse.down();
    await s.wait(90);
    await s.page.mouse.up();
    await s.wait(5200);
    await s.checkpoint('reading');
    await s.moveTo(1010, 640, 1100);
    await s.wait(900);
  },
};
