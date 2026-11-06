import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from './client';
import { anamnesisApi } from './anamnesis';
import { appointmentsBackfillFinance, appointmentsApi } from './appointments';
import { assistantApi } from './assistant';
import { auditLogsApi } from './auditLogs';
import { availabilityApi } from './availability';
import { catalogsApi } from './catalogs';
import { documentTemplatesApi } from './documentTemplates';
import { documentsApi } from './documents';
import { equipmentApi } from './equipment';
import { feedbackApi } from './feedback';
import { financeApi } from './finance';
import { goalsApi } from './goals';
import { inventoryApi } from './inventory';
import { messagesApi } from './messages';
import { metricsApi } from './metrics';
import { notificationsApi } from './notifications';
import { packagesApi } from './packages';
import { patientsApi } from './patients';
import { paymentMethodsApi } from './paymentMethods';
import { pendenciasApi } from './pendencias';
import { proceduresApi } from './procedures';
import { promotionsApi } from './promotions';
import { publicApi } from './public';
import { recurringExpensesApi } from './recurring-expenses';
import { rolesApi } from './roles';
import { skincareApi } from './skincare';
import { tenantPlanApi } from './tenantPlan';
import { usersApi } from './users';

const DATA = { ok: true, url: 'U', count: 7 };

/** Troca File/FormData por valores comparáveis. */
function norm(v: unknown): unknown {
  if (v instanceof File) return { __file: v.name };
  if (v instanceof FormData) {
    return {
      __fd: [...v.entries()].map(([k, x]) => [
        k,
        x instanceof File ? `File:${x.name}` : x,
      ]),
    };
  }
  return v;
}
const FILE = () => new File(['x'], 'a.png', { type: 'image/png' });
const revive = (a: unknown): unknown =>
  a && typeof a === 'object' && '__file' in a ? FILE() : a;

type Row = [fn: string, args: unknown[], call: unknown[], result?: unknown];

function run(
  api_: Record<string, (...a: never[]) => Promise<unknown>>,
  rows: Row[],
) {
  it.each(rows)('%s -> %j', async (fn, args, call, result) => {
    const method = call[0] as 'get' | 'post' | 'put' | 'patch' | 'delete';
    vi.mocked(api[method]).mockResolvedValue({ data: DATA });
    const res = await (api_[fn] as (...a: unknown[]) => Promise<unknown>)(
      ...args.map(revive),
    );
    expect(api[method]).toHaveBeenCalledOnce();
    expect(
      JSON.parse(
        JSON.stringify(vi.mocked(api[method]).mock.calls[0].map(norm)),
      ),
    ).toEqual(call.slice(1));
    if (result === 'DATA') expect(res).toEqual(DATA);
    else if (result === 'AXIOS') expect(res).toEqual({ data: DATA });
    else expect(res).toEqual(result);
  });
}

describe('api endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('anamnesisApi', () => {
    run(anamnesisApi as never, [
      [
        'listQuestions',
        ['kind-1'],
        ['get', '/anamnesis/questions', { params: { kind: 'kind-1' } }],
        'DATA',
      ],
      [
        'createQuestion',
        [{ payloadK: 'v' }],
        ['post', '/anamnesis/questions', { payloadK: 'v' }],
        'DATA',
      ],
      [
        'updateQuestion',
        ['id-1', { payloadK: 'v' }],
        ['patch', '/anamnesis/questions/id-1', { payloadK: 'v' }],
        'DATA',
      ],
      [
        'reorderQuestions',
        ['kind-1', ['i1', 'i2']],
        [
          'patch',
          '/anamnesis/questions/reorder',
          { kind: 'kind-1', ids: ['i1', 'i2'] },
        ],
        'DATA',
      ],
      [
        'createLink',
        ['patientId-1'],
        ['post', '/anamnesis/links', { patientId: 'patientId-1' }],
        'DATA',
      ],
      [
        'getPublicForm',
        ['token-1'],
        ['get', '/public/anamnesis/token-1'],
        'DATA',
      ],
      [
        'submitPublic',
        ['token-1', { answersK: 'v' }],
        ['post', '/public/anamnesis/token-1', { answers: { answersK: 'v' } }],
        undefined,
      ],
    ]);
  });

  describe('appointmentsBackfillFinance', () => {
    run({ appointmentsBackfillFinance } as never, [
      [
        'appointmentsBackfillFinance',
        [],
        ['post', '/appointments/backfill-finance'],
        'DATA',
      ],
    ]);
  });

  describe('appointmentsApi', () => {
    run(appointmentsApi as never, [
      [
        'list',
        ['from-1', 'to-1'],
        ['get', '/appointments', { params: { from: 'from-1', to: 'to-1' } }],
        'DATA',
      ],
      ['list', [], ['get', '/appointments', { params: {} }], 'DATA'],
      [
        'getRecurrenceLimit',
        ['patientId-1', 'procedureId-1', 'excludeId-1'],
        [
          'get',
          '/appointments/recurrence-limit',
          {
            params: {
              patientId: 'patientId-1',
              procedureId: 'procedureId-1',
              excludeId: 'excludeId-1',
            },
          },
        ],
        'DATA',
      ],
      [
        'getRecurrenceLimit',
        [],
        ['get', '/appointments/recurrence-limit', { params: {} }],
        'DATA',
      ],
      [
        'promotionPreview',
        ['procedureId-1', 'date-1'],
        [
          'get',
          '/appointments/promotion-preview',
          { params: { procedureId: 'procedureId-1', date: 'date-1' } },
        ],
        'DATA',
      ],
      ['findOne', ['id-1'], ['get', '/appointments/id-1'], 'DATA'],
      [
        'create',
        [{ payloadK: 'v' }],
        ['post', '/appointments', { payloadK: 'v' }],
        'DATA',
      ],
      [
        'update',
        ['id-1', { payloadK: 'v' }],
        ['patch', '/appointments/id-1', { payloadK: 'v' }],
        'DATA',
      ],
      ['pending', [], ['get', '/appointments/pending'], 'DATA'],
      ['remove', ['id-1'], ['delete', '/appointments/id-1'], undefined],
      ['start', ['id-1'], ['patch', '/appointments/id-1/start'], 'DATA'],
      ['finish', ['id-1'], ['patch', '/appointments/id-1/finish'], 'DATA'],
      ['resume', ['id-1'], ['patch', '/appointments/id-1/resume'], 'DATA'],
    ]);
  });

  describe('assistantApi', () => {
    run(assistantApi as never, [
      [
        'ask',
        ['question-1'],
        ['post', '/assistant/ask', { question: 'question-1' }],
        'DATA',
      ],
    ]);
  });

  describe('auditLogsApi', () => {
    run(auditLogsApi as never, [
      [
        'byEntity',
        ['entity-1', 'entityId-1'],
        ['get', '/audit-logs/entity-1/entityId-1'],
        'AXIOS',
      ],
      [
        'findAll',
        [{ filtersK: 'v' }],
        ['get', '/audit-logs?filtersK=v'],
        'AXIOS',
      ],
      ['findAll', [], ['get', '/audit-logs?'], 'AXIOS'],
    ]);
  });

  describe('availabilityApi', () => {
    run(availabilityApi as never, [
      [
        'listWorkingHours',
        ['userId-1'],
        ['get', '/users/userId-1/availability/working-hours'],
        'DATA',
      ],
      [
        'upsertWorkingHours',
        ['userId-1', { payloadK: 'v' }],
        [
          'put',
          '/users/userId-1/availability/working-hours',
          { payloadK: 'v' },
        ],
        'DATA',
      ],
      [
        'removeWorkingHours',
        ['userId-1', 3],
        ['delete', '/users/userId-1/availability/working-hours/3'],
        undefined,
      ],
      [
        'listUnavailability',
        ['userId-1'],
        ['get', '/users/userId-1/availability/unavailability'],
        'DATA',
      ],
      [
        'createUnavailability',
        ['userId-1', { payloadK: 'v' }],
        [
          'post',
          '/users/userId-1/availability/unavailability',
          { payloadK: 'v' },
        ],
        'DATA',
      ],
      [
        'createUnavailability',
        [],
        ['post', '/users/undefined/availability/unavailability', null],
        'DATA',
      ],
      [
        'removeUnavailability',
        ['userId-1', 'id-1'],
        ['delete', '/users/userId-1/availability/unavailability/id-1'],
        undefined,
      ],
      [
        'listUnavailabilityInRange',
        ['from-1', 'to-1'],
        [
          'get',
          '/availability/unavailability-range',
          { params: { from: 'from-1', to: 'to-1' } },
        ],
        'DATA',
      ],
      [
        'listAvailableProfessionals',
        ['startAt-1', 'endAt-1', 'excludeAppointmentId-1'],
        [
          'get',
          '/availability/available-professionals',
          {
            params: {
              startAt: 'startAt-1',
              endAt: 'endAt-1',
              excludeAppointmentId: 'excludeAppointmentId-1',
            },
          },
        ],
        'DATA',
      ],
      [
        'listAvailableProfessionals',
        [],
        ['get', '/availability/available-professionals', { params: {} }],
        'DATA',
      ],
    ]);
  });

  describe('catalogsApi', () => {
    run(catalogsApi as never, [
      [
        'list',
        ['kind-1'],
        ['get', '/catalogs', { params: { kind: 'kind-1' } }],
        'DATA',
      ],
      ['list', [], ['get', '/catalogs', {}], 'DATA'],
      ['measurementTypes', [], ['get', '/measurement-types'], 'DATA'],
    ]);
  });

  describe('documentTemplatesApi', () => {
    run(documentTemplatesApi as never, [
      ['list', [], ['get', '/document-templates'], 'DATA'],
      [
        'create',
        [{ payloadK: 'v' }],
        ['post', '/document-templates', { payloadK: 'v' }],
        'DATA',
      ],
      [
        'update',
        ['id-1', { payloadK: 'v' }],
        ['patch', '/document-templates/id-1', { payloadK: 'v' }],
        'DATA',
      ],
      ['remove', ['id-1'], ['delete', '/document-templates/id-1'], undefined],
    ]);
  });

  describe('documentsApi', () => {
    run(documentsApi as never, [
      [
        'list',
        [{ filterK: 'v' }],
        ['get', '/documents', { params: { filterK: 'v' } }],
        'DATA',
      ],
      ['list', [], ['get', '/documents', { params: {} }], 'DATA'],
      ['get', ['id-1'], ['get', '/documents/id-1'], 'DATA'],
      [
        'upload',
        [{ __file: 'a.png' }, { metaK: 'v' }],
        [
          'post',
          '/documents/upload',
          { __fd: [['file', 'File:a.png']] },
          { headers: { 'Content-Type': 'multipart/form-data' } },
        ],
        'DATA',
      ],
      [
        'createFromTemplate',
        ['templateId-1', { metaK: 'v' }],
        [
          'post',
          '/documents/from-template',
          { templateId: 'templateId-1', metaK: 'v' },
        ],
        'DATA',
      ],
      [
        'update',
        ['id-1', { payloadK: 'v' }],
        ['patch', '/documents/id-1', { payloadK: 'v' }],
        'DATA',
      ],
      [
        'attachFile',
        ['id-1', { __file: 'a.png' }],
        [
          'post',
          '/documents/id-1/file',
          { __fd: [['file', 'File:a.png']] },
          { headers: { 'Content-Type': 'multipart/form-data' } },
        ],
        'DATA',
      ],
      ['remove', ['id-1'], ['delete', '/documents/id-1'], undefined],
      ['getAccessUrl', ['id-1'], ['get', '/documents/id-1/access-url'], 'U'],
    ]);
  });

  describe('equipmentApi', () => {
    run(equipmentApi as never, [
      ['list', [], ['get', '/equipment'], 'DATA'],
      [
        'dueSoon',
        [3],
        ['get', '/equipment/due-soon', { params: { days: 3 } }],
        'DATA',
      ],
      [
        'dueSoon',
        [],
        ['get', '/equipment/due-soon', { params: { days: 30 } }],
        'DATA',
      ],
      [
        'create',
        [{ payloadK: 'v' }],
        ['post', '/equipment', { payloadK: 'v' }],
        'DATA',
      ],
      [
        'update',
        ['id-1', { payloadK: 'v' }],
        ['patch', '/equipment/id-1', { payloadK: 'v' }],
        'DATA',
      ],
      [
        'registerMaintenance',
        ['id-1'],
        ['post', '/equipment/id-1/maintenance'],
        'DATA',
      ],
      ['remove', ['id-1'], ['delete', '/equipment/id-1'], undefined],
    ]);
  });

  describe('feedbackApi', () => {
    run(feedbackApi as never, [
      [
        'create',
        [{ payloadK: 'v' }],
        ['post', '/feedback', { payloadK: 'v' }],
        'DATA',
      ],
      [
        'list',
        ['type-1'],
        ['get', '/feedback', { params: { type: 'type-1' } }],
        'DATA',
      ],
      ['list', [], ['get', '/feedback', {}], 'DATA'],
    ]);
  });

  describe('financeApi', () => {
    run(financeApi as never, [
      [
        'list',
        ['from-1', 'to-1', 'pendingInvoice-1', 'expenseType-1', 'patientId-1'],
        [
          'get',
          '/finance',
          {
            params: {
              from: 'from-1',
              to: 'to-1',
              pendingInvoice: 'true',
              expenseType: 'expenseType-1',
              patientId: 'patientId-1',
            },
          },
        ],
        'DATA',
      ],
      ['list', [], ['get', '/finance', { params: {} }], 'DATA'],
      [
        'listUpcomingUnpaidExpenses',
        ['from-1', 'to-1'],
        [
          'get',
          '/finance/upcoming-expenses',
          { params: { from: 'from-1', to: 'to-1' } },
        ],
        'DATA',
      ],
      [
        'listUpcomingUnpaidExpenses',
        [],
        ['get', '/finance/upcoming-expenses', { params: {} }],
        'DATA',
      ],
      [
        'setInvoiceIssued',
        ['id-1', true],
        ['patch', '/finance/id-1/invoice', { issued: true }],
        'DATA',
      ],
      [
        'summary',
        ['from-1', 'to-1'],
        ['get', '/finance/summary', { params: { from: 'from-1', to: 'to-1' } }],
        'DATA',
      ],
      ['summary', [], ['get', '/finance/summary', { params: {} }], 'DATA'],
      [
        'markPaid',
        ['id-1', true],
        ['patch', '/finance/id-1/paid', { paid: true }],
        'DATA',
      ],
      [
        'create',
        [{ payloadK: 'v' }],
        ['post', '/finance', { payloadK: 'v' }],
        'DATA',
      ],
      [
        'update',
        ['id-1', { payloadK: 'v' }],
        ['patch', '/finance/id-1', { payloadK: 'v' }],
        'DATA',
      ],
      ['remove', ['id-1'], ['delete', '/finance/id-1'], undefined],
    ]);
  });

  describe('goalsApi', () => {
    run(goalsApi as never, [
      [
        'list',
        [{ paramsK: 'v' }],
        ['get', '/goals', { params: { paramsK: 'v' } }],
        'DATA',
      ],
      ['list', [], ['get', '/goals', { params: {} }], 'DATA'],
      [
        'preview',
        [{ paramsK: 'v' }],
        ['get', '/goals/preview', { params: { paramsK: 'v' } }],
        'DATA',
      ],
      [
        'create',
        [{ payloadK: 'v' }],
        ['post', '/goals', { payloadK: 'v' }],
        'DATA',
      ],
      [
        'update',
        ['id-1', { payloadK: 'v' }],
        ['patch', '/goals/id-1', { payloadK: 'v' }],
        'DATA',
      ],
      ['remove', ['id-1'], ['delete', '/goals/id-1'], undefined],
    ]);
  });

  describe('inventoryApi', () => {
    run(inventoryApi as never, [
      ['list', [], ['get', '/inventory'], 'DATA'],
      ['listLowStock', [], ['get', '/inventory/low-stock'], 'DATA'],
      ['findOne', ['id-1'], ['get', '/inventory/id-1'], 'DATA'],
      [
        'getDeletionPreview',
        ['id-1'],
        ['get', '/inventory/id-1/deletion-preview'],
        'DATA',
      ],
      [
        'create',
        [{ payloadK: 'v' }],
        ['post', '/inventory', { payloadK: 'v' }],
        'DATA',
      ],
      [
        'update',
        ['id-1', { payloadK: 'v' }],
        ['patch', '/inventory/id-1', { payloadK: 'v' }],
        'DATA',
      ],
      ['remove', ['id-1'], ['delete', '/inventory/id-1'], undefined],
      [
        'createMovement',
        ['id-1', { payloadK: 'v' }],
        ['post', '/inventory/id-1/movements', { payloadK: 'v' }],
        'DATA',
      ],
      [
        'createMovement',
        [],
        ['post', '/inventory/undefined/movements', null],
        'DATA',
      ],
      [
        'createBulkPurchase',
        [{ payloadK: 'v' }],
        ['post', '/inventory/bulk-purchase', { payloadK: 'v' }],
        'DATA',
      ],
    ]);
  });

  describe('messagesApi', () => {
    run(messagesApi as never, [
      ['list', [], ['get', '/messages'], 'DATA'],
      [
        'create',
        [{ payloadK: 'v' }],
        ['post', '/messages', { payloadK: 'v' }],
        'DATA',
      ],
      [
        'update',
        ['id-1', { payloadK: 'v' }],
        ['patch', '/messages/id-1', { payloadK: 'v' }],
        'DATA',
      ],
      ['remove', ['id-1'], ['delete', '/messages/id-1'], undefined],
      [
        'listPendingDispatches',
        [],
        ['get', '/messages/dispatches/pending'],
        'DATA',
      ],
      [
        'markDispatchSent',
        ['id-1'],
        ['patch', '/messages/dispatches/id-1/sent'],
        'DATA',
      ],
      [
        'recordManualDispatch',
        [{ payloadK: 'v' }],
        ['post', '/messages/dispatches/manual', { payloadK: 'v' }],
        'DATA',
      ],
      [
        'recordManualDispatch',
        [],
        ['post', '/messages/dispatches/manual', null],
        'DATA',
      ],
    ]);
  });

  describe('metricsApi', () => {
    run(metricsApi as never, [
      [
        'get',
        ['from-1', 'to-1'],
        ['get', '/metrics', { params: { from: 'from-1', to: 'to-1' } }],
        'DATA',
      ],
    ]);
  });

  describe('notificationsApi', () => {
    run(notificationsApi as never, [
      [
        'list',
        [{ optsK: 'v' }],
        ['get', '/notifications', { params: {} }],
        'DATA',
      ],
      ['list', [], ['get', '/notifications', { params: {} }], 'DATA'],
      ['unreadCount', [], ['get', '/notifications/unread-count'], 7],
      [
        'markAsRead',
        ['id-1'],
        ['patch', '/notifications/id-1/read'],
        undefined,
      ],
      ['markAllAsRead', [], ['patch', '/notifications/read-all'], undefined],
      ['remove', ['id-1'], ['delete', '/notifications/id-1'], undefined],
      ['getPreferences', [], ['get', '/notifications/preferences'], 'DATA'],
      [
        'setPreference',
        ['type-1', true],
        [
          'patch',
          '/notifications/preferences',
          { type: 'type-1', enabled: true },
        ],
        undefined,
      ],
    ]);
  });

  describe('packagesApi', () => {
    run(packagesApi as never, [
      ['list', [], ['get', '/packages'], 'DATA'],
      ['getStats', [], ['get', '/packages/stats/summary'], 'DATA'],
      ['findOne', ['id-1'], ['get', '/packages/id-1'], 'DATA'],
      ['saleQuote', ['id-1'], ['get', '/packages/id-1/sale-quote'], 'DATA'],
      [
        'create',
        [{ payloadK: 'v' }],
        ['post', '/packages', { payloadK: 'v' }],
        'DATA',
      ],
      [
        'update',
        ['id-1', { payloadK: 'v' }],
        ['patch', '/packages/id-1', { payloadK: 'v' }],
        'DATA',
      ],
      ['remove', ['id-1'], ['delete', '/packages/id-1'], undefined],
      [
        'listPatientPackages',
        ['patientId-1'],
        [
          'get',
          '/packages/patient-packages/list',
          { params: { patientId: 'patientId-1' } },
        ],
        'DATA',
      ],
      [
        'listPatientPackages',
        [],
        ['get', '/packages/patient-packages/list', { params: {} }],
        'DATA',
      ],
      [
        'listActiveForPatient',
        ['patientId-1'],
        ['get', '/packages/patient-packages/active/patientId-1'],
        'DATA',
      ],
      [
        'findPatientPackage',
        ['id-1'],
        ['get', '/packages/patient-packages/id-1'],
        'DATA',
      ],
      [
        'createPatientPackage',
        [{ payloadK: 'v' }],
        ['post', '/packages/patient-packages', { payloadK: 'v' }],
        'DATA',
      ],
      [
        'updatePatientPackage',
        ['id-1', { payloadK: 'v' }],
        ['patch', '/packages/patient-packages/id-1', { payloadK: 'v' }],
        'DATA',
      ],
      [
        'updatePatientPackage',
        [],
        ['patch', '/packages/patient-packages/undefined', null],
        'DATA',
      ],
    ]);
  });

  describe('patientsApi', () => {
    run(patientsApi as never, [
      [
        'list',
        ['search-1'],
        ['get', '/patients', { params: { search: 'search-1' } }],
        'DATA',
      ],
      ['list', [], ['get', '/patients', { params: {} }], 'DATA'],
      ['stats', [], ['get', '/patients/stats'], 'DATA'],
      ['findOne', ['id-1'], ['get', '/patients/id-1'], 'DATA'],
      [
        'create',
        [{ payloadK: 'v' }],
        ['post', '/patients', { payloadK: 'v' }],
        'DATA',
      ],
      [
        'update',
        ['id-1', { payloadK: 'v' }],
        ['patch', '/patients/id-1', { payloadK: 'v' }],
        'DATA',
      ],
      [
        'updateAnamnesis',
        ['id-1', { anamnesisK: 'v' }],
        ['patch', '/patients/id-1', { anamnesis: { anamnesisK: 'v' } }],
        'DATA',
      ],
      ['remove', ['id-1'], ['delete', '/patients/id-1'], undefined],
      [
        'uploadPhoto',
        ['id-1', { __file: 'a.png' }],
        [
          'post',
          '/patients/id-1/photo',
          { __fd: [['file', 'File:a.png']] },
          { headers: { 'Content-Type': 'multipart/form-data' } },
        ],
        'DATA',
      ],
      ['removePhoto', ['id-1'], ['delete', '/patients/id-1/photo'], 'DATA'],
      ['getPhotoAccessUrl', ['id-1'], ['get', '/patients/id-1/photo-url'], 'U'],
      [
        'getReliability',
        ['id-1'],
        ['get', '/patients/id-1/reliability'],
        'DATA',
      ],
      ['listPhotos', ['id-1'], ['get', '/patients/id-1/photos'], 'DATA'],
      [
        'addPhoto',
        ['id-1', { __file: 'a.png' }, { metaK: 'v' }],
        [
          'post',
          '/patients/id-1/photos',
          {
            __fd: [
              ['file', 'File:a.png'],
              ['appointmentId', 'undefined'],
              ['phase', 'undefined'],
            ],
          },
          { headers: { 'Content-Type': 'multipart/form-data' } },
        ],
        'DATA',
      ],
      [
        'removePhoto2',
        ['id-1', 'photoId-1'],
        ['delete', '/patients/id-1/photos/photoId-1'],
        undefined,
      ],
      [
        'listMeasurements',
        ['id-1'],
        ['get', '/patients/id-1/measurements'],
        'DATA',
      ],
      [
        'createMeasurement',
        ['id-1', { payloadK: 'v' }],
        ['post', '/patients/id-1/measurements', { payloadK: 'v' }],
        'DATA',
      ],
      [
        'updateMeasurement',
        ['id-1', 'measurementId-1', { payloadK: 'v' }],
        [
          'patch',
          '/patients/id-1/measurements/measurementId-1',
          { payloadK: 'v' },
        ],
        'DATA',
      ],
      [
        'removeMeasurement',
        ['id-1', 'measurementId-1'],
        ['delete', '/patients/id-1/measurements/measurementId-1'],
        undefined,
      ],
    ]);
  });

  describe('paymentMethodsApi', () => {
    run(paymentMethodsApi as never, [
      ['list', [], ['get', '/payment-methods'], 'DATA'],
      ['get', ['id-1'], ['get', '/payment-methods/id-1'], 'DATA'],
      [
        'create',
        [{ payloadK: 'v' }],
        ['post', '/payment-methods', { payloadK: 'v' }],
        'DATA',
      ],
      [
        'update',
        ['id-1', { payloadK: 'v' }],
        ['patch', '/payment-methods/id-1', { payloadK: 'v' }],
        'DATA',
      ],
      ['remove', ['id-1'], ['delete', '/payment-methods/id-1'], undefined],
    ]);
  });

  describe('pendenciasApi', () => {
    run(pendenciasApi as never, [
      ['list', [], ['get', '/pendencias'], 'DATA'],
      ['listResolved', [], ['get', '/pendencias/resolved'], 'DATA'],
      ['getRules', [], ['get', '/pendencias/rules'], 'DATA'],
      [
        'updateRules',
        [{ rulesK: 'v' }],
        ['put', '/pendencias/rules', { rules: { rulesK: 'v' } }],
        'DATA',
      ],
      [
        'resolve',
        ['key-1'],
        ['post', '/pendencias/resolve', { key: 'key-1' }],
        undefined,
      ],
      [
        'assign',
        ['key-1', 'assigneeId-1'],
        [
          'post',
          '/pendencias/assign',
          { key: 'key-1', assigneeId: 'assigneeId-1' },
        ],
        undefined,
      ],
      ['reopen', ['id-1'], ['post', '/pendencias/id-1/reopen'], undefined],
      [
        'create',
        [{ payloadK: 'v' }],
        ['post', '/pendencias', { payloadK: 'v' }],
        'DATA',
      ],
      [
        'update',
        ['id-1', { payloadK: 'v' }],
        ['patch', '/pendencias/id-1', { payloadK: 'v' }],
        'DATA',
      ],
      ['remove', ['id-1'], ['delete', '/pendencias/id-1'], undefined],
    ]);
  });

  describe('proceduresApi', () => {
    run(proceduresApi as never, [
      ['list', [], ['get', '/procedures'], 'DATA'],
      ['findOne', ['id-1'], ['get', '/procedures/id-1'], 'DATA'],
      [
        'create',
        [{ payloadK: 'v' }],
        ['post', '/procedures', { payloadK: 'v' }],
        'DATA',
      ],
      [
        'update',
        ['id-1', { payloadK: 'v' }],
        ['patch', '/procedures/id-1', { payloadK: 'v' }],
        'DATA',
      ],
      ['remove', ['id-1'], ['delete', '/procedures/id-1'], undefined],
    ]);
  });

  describe('promotionsApi', () => {
    run(promotionsApi as never, [
      ['list', [], ['get', '/promotions'], 'DATA'],
      ['get', ['id-1'], ['get', '/promotions/id-1'], 'DATA'],
      [
        'create',
        [{ payloadK: 'v' }],
        ['post', '/promotions', { payloadK: 'v' }],
        'DATA',
      ],
      [
        'update',
        ['id-1', { payloadK: 'v' }],
        ['patch', '/promotions/id-1', { payloadK: 'v' }],
        'DATA',
      ],
      ['remove', ['id-1'], ['delete', '/promotions/id-1'], undefined],
    ]);
  });

  describe('publicApi', () => {
    run(publicApi as never, [
      ['listPlans', [], ['get', '/public/plans'], 'DATA'],
    ]);
  });

  describe('recurringExpensesApi', () => {
    run(recurringExpensesApi as never, [
      ['list', [], ['get', '/recurring-expenses'], 'DATA'],
      [
        'getHourlyCostSettings',
        [],
        ['get', '/recurring-expenses/hourly-cost-settings'],
        'DATA',
      ],
      [
        'updateHourlyCostSettings',
        [true],
        [
          'patch',
          '/recurring-expenses/hourly-cost-settings',
          { includeVariable: true },
        ],
        'DATA',
      ],
      [
        'getHourlyCostSummary',
        [true],
        [
          'get',
          '/recurring-expenses/hourly-cost-summary',
          { params: { includeVariable: 'true' } },
        ],
        'DATA',
      ],
      [
        'create',
        [{ payloadK: 'v' }],
        ['post', '/recurring-expenses', { payloadK: 'v' }],
        'DATA',
      ],
      [
        'update',
        ['id-1', { payloadK: 'v' }],
        ['patch', '/recurring-expenses/id-1', { payloadK: 'v' }],
        'DATA',
      ],
      ['remove', ['id-1'], ['delete', '/recurring-expenses/id-1'], undefined],
      [
        'generate',
        [3, 3],
        [
          'post',
          '/recurring-expenses/generate',
          null,
          { params: { year: 3, month: 3 } },
        ],
        'DATA',
      ],
      [
        'generate',
        [],
        ['post', '/recurring-expenses/generate', null, { params: {} }],
        'DATA',
      ],
    ]);
  });

  describe('rolesApi', () => {
    run(rolesApi as never, [
      ['list', [], ['get', '/roles'], 'DATA'],
      ['catalog', [], ['get', '/roles/catalog'], 'DATA'],
      [
        'create',
        [{ payloadK: 'v' }],
        ['post', '/roles', { payloadK: 'v' }],
        'DATA',
      ],
      [
        'update',
        ['id-1', { payloadK: 'v' }],
        ['patch', '/roles/id-1', { payloadK: 'v' }],
        'DATA',
      ],
      ['remove', ['id-1'], ['delete', '/roles/id-1'], undefined],
    ]);
  });

  describe('skincareApi', () => {
    run(skincareApi as never, [
      ['listProducts', [], ['get', '/skincare/products'], 'DATA'],
      [
        'createProduct',
        [{ payloadK: 'v' }],
        ['post', '/skincare/products', { payloadK: 'v' }],
        'DATA',
      ],
      [
        'updateProduct',
        ['id-1', { payloadK: 'v' }],
        ['patch', '/skincare/products/id-1', { payloadK: 'v' }],
        'DATA',
      ],
      [
        'removeProduct',
        ['id-1'],
        ['delete', '/skincare/products/id-1'],
        undefined,
      ],
      ['listRules', [], ['get', '/skincare/rules'], 'DATA'],
      [
        'createRule',
        [{ payloadK: 'v' }],
        ['post', '/skincare/rules', { payloadK: 'v' }],
        'DATA',
      ],
      [
        'updateRule',
        ['id-1', { payloadK: 'v' }],
        ['patch', '/skincare/rules/id-1', { payloadK: 'v' }],
        'DATA',
      ],
      ['removeRule', ['id-1'], ['delete', '/skincare/rules/id-1'], undefined],
      [
        'listRoutines',
        ['patientId-1'],
        ['get', '/skincare/routines', { params: { patientId: 'patientId-1' } }],
        'DATA',
      ],
      [
        'listRoutines',
        [],
        ['get', '/skincare/routines', { params: {} }],
        'DATA',
      ],
      [
        'createRoutine',
        [{ payloadK: 'v' }],
        ['post', '/skincare/routines', { payloadK: 'v' }],
        'DATA',
      ],
      [
        'updateRoutine',
        ['id-1', { payloadK: 'v' }],
        ['patch', '/skincare/routines/id-1', { payloadK: 'v' }],
        'DATA',
      ],
      [
        'removeRoutine',
        ['id-1'],
        ['delete', '/skincare/routines/id-1'],
        undefined,
      ],
    ]);
  });

  describe('tenantPlanApi', () => {
    run(tenantPlanApi as never, [
      ['getSummary', [], ['get', '/tenant/plan'], 'DATA'],
    ]);
  });

  describe('usersApi', () => {
    run(usersApi as never, [
      ['list', [], ['get', '/users'], 'DATA'],
      [
        'listActive',
        [true],
        ['get', '/users/active', { params: { forAppointments: 'true' } }],
        'DATA',
      ],
      ['listActive', [], ['get', '/users/active', {}], 'DATA'],
      [
        'listAppointmentProviders',
        [],
        ['get', '/users/active', { params: { forAppointments: 'true' } }],
        'DATA',
      ],
      [
        'create',
        [{ payloadK: 'v' }],
        ['post', '/users', { payloadK: 'v' }],
        'DATA',
      ],
      [
        'update',
        ['id-1', { payloadK: 'v' }],
        ['patch', '/users/id-1', { payloadK: 'v' }],
        'DATA',
      ],
      ['remove', ['id-1'], ['delete', '/users/id-1'], undefined],
      [
        'uploadPhoto',
        ['id-1', { __file: 'a.png' }],
        [
          'post',
          '/users/id-1/photo',
          { __fd: [['file', 'File:a.png']] },
          { headers: { 'Content-Type': 'multipart/form-data' } },
        ],
        'DATA',
      ],
      ['removePhoto', ['id-1'], ['delete', '/users/id-1/photo'], 'DATA'],
      ['getPhotoUrl', ['id-1'], ['get', '/users/id-1/photo-url'], 'U'],
    ]);
  });
});
