import {
  PROMETHEUS_NAMESPACE_METRIC_SERVICE_OPTIONS,
  PROMETHEUS_NAMESPACE_METRIC_SERVICE_STORAGE_KEY,
  getNamespaceMetricService,
  setNamespaceMetricService,
} from './prometheus';

afterEach(() => {
  window.localStorage.clear();
});

test('only the v71 exporter is offered as a data source', () => {
  expect(PROMETHEUS_NAMESPACE_METRIC_SERVICE_OPTIONS.map((option) => option.value)).toEqual([
    'prom-app-v71',
  ]);
});

test('a browser that saved the retired v53 source falls back to v71', () => {
  window.localStorage.setItem(PROMETHEUS_NAMESPACE_METRIC_SERVICE_STORAGE_KEY, 'prom-app');
  expect(getNamespaceMetricService()).toBe('prom-app-v71');
  expect(setNamespaceMetricService('prom-app')).toBe('prom-app-v71');
});
