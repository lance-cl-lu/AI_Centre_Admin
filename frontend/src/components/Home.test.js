import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import Home from './Home';

const jsonResponse = (body) => ({
  ok: true,
  status: 200,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

let patchBodies;

beforeEach(() => {
  patchBodies = [];
  global.fetch = jest.fn(async (url, options = {}) => {
    if (String(url).includes('/api/node-resource-monitor/config/')) {
      if (options.method === 'PATCH') {
        const body = JSON.parse(options.body);
        patchBodies.push(body);
        return jsonResponse(body);
      }
      return jsonResponse({ cpuCostPerMinute: '0.03', gpuCostPerMinute: '0.70833' });
    }
    if (String(url).includes('/api/check/syschronize/')) {
      return jsonResponse([]);
    }
    if (String(url).includes('/api/v1/')) {
      return jsonResponse({ status: 'success', data: { resultType: 'vector', result: [] } });
    }
    return jsonResponse({});
  });
});

const renderHomeInEditMode = async () => {
  render(
    <AuthContext.Provider value={{ user: { username: 'admin', is_superuser: true } }}>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </AuthContext.Provider>
  );
  await waitFor(() => expect(screen.getByLabelText('GPU 費率（每分鐘）').value).toBe('0.70833'));
  fireEvent.click(screen.getByRole('button', { name: '編輯費率' }));
};

test.each([['0.12345'], ['0.00001'], ['1.5']])('accepts a rate of %s', async (rate) => {
  await renderHomeInEditMode();

  const input = screen.getByLabelText('CPU 費率（每分鐘）');
  fireEvent.change(input, { target: { value: rate } });

  expect(input.validity.valid).toBe(true);
});

test('a five-decimal rate already stored does not block saving the other rate', async () => {
  await renderHomeInEditMode();

  expect(screen.getByLabelText('GPU 費率（每分鐘）').validity.valid).toBe(true);
  fireEvent.change(screen.getByLabelText('CPU 費率（每分鐘）'), { target: { value: '0.04' } });
  fireEvent.click(screen.getByRole('button', { name: '儲存費率' }));

  await waitFor(() => expect(patchBodies).toHaveLength(1));
  expect(patchBodies[0]).toEqual({ cpuCostPerMinute: '0.04', gpuCostPerMinute: '0.70833' });
});

test('a negative rate is still rejected', async () => {
  await renderHomeInEditMode();

  const input = screen.getByLabelText('CPU 費率（每分鐘）');
  fireEvent.change(input, { target: { value: '-0.5' } });

  expect(input.validity.valid).toBe(false);
});
