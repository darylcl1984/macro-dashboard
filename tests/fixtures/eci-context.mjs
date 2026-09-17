// Synthetic calibration for exact numerical checks, independent of live refits.
export function eciFixture() {
  const eci = [
    { date: '2025-01-01', value: 100, label: 'Anchor model' },
    { date: '2025-02-01', value: 105, label: 'Measured model' },
    { date: '2025-03-01', value: 110, label: 'Checked model' },
    { date: '2025-04-01', value: 115, label: 'Future model' },
  ];
  const metr = {
    anchor_id: 'anchor', points_per_doubling: 5, reliable_limit_minutes: 960,
    points: [
      { id: 'anchor', label: 'Anchor model', date: '2025-01-01', eci: 100, minutes: 60, low_minutes: 40, high_minutes: 90 },
      { id: 'measured', label: 'Measured model', date: '2025-02-01', eci: 105, minutes: 150, low_minutes: 100, high_minutes: 200 },
      { id: 'checked', label: 'Checked model', date: '2025-03-01', eci: 110, minutes: 300, low_minutes: 200, high_minutes: 400 },
    ],
  };
  return { eci, metr };
}
