'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Building2,
  CheckCircle2,
  History,
  LayoutDashboard,
  Loader2,
  Package,
  PlusCircle,
  RefreshCw,
  Save,
  Search,
  Users,
} from 'lucide-react';
import { appendOrderLog, fetchMasterData, updateSkuPrice } from './actions';

const navItems = [
  { id: 'entry', label: 'Data Entry', icon: PlusCircle },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'buyerAnalytics', label: 'Buyer Analytics', icon: BarChart3 },
  { id: 'logs', label: 'Storage Logs', icon: History },
  { id: 'skus', label: 'SKU Master', icon: Package },
  { id: 'buyers', label: 'Buyer Master', icon: Users },
];

const financialYears = ['ALL', '2026-2027', '2025-2026'];
const viewModes = ['Detailed Logs', 'Consolidated View'];
const buyerViewModes = ['Detailed Logs', 'Consolidated'];
const buyerGroupModes = ['Year-wise', 'Month-wise'];

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 2,
});

const createOrderId = () => `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
const getToday = () => new Date().toISOString().split('T')[0];
const normalize = value => String(value || '').toLowerCase().trim();

const createInitialForm = () => ({
  date: getToday(),
  orderId: createOrderId(),
  buyerSearch: '',
  buyerId: '',
  productSearch: '',
  productId: '',
  quantity: '',
  unitPrice: '',
  notes: '',
});

const getDateParts = value => {
  const raw = String(value || '').trim();
  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

  if (isoMatch) {
    return {
      year: Number(isoMatch[1]),
      month: Number(isoMatch[2]),
      day: Number(isoMatch[3]),
    };
  }

  const slashMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);

  if (slashMatch) {
    return {
      year: Number(slashMatch[3]),
      month: Number(slashMatch[2]),
      day: Number(slashMatch[1]),
    };
  }

  return null;
};

const getFinancialYear = date => {
  const parts = getDateParts(date);

  if (!parts || !parts.year || !parts.month) {
    return 'Unknown';
  }

  const startYear = parts.month >= 4 ? parts.year : parts.year - 1;
  return `${startYear}-${startYear + 1}`;
};

const getDateSortValue = date => {
  const parts = getDateParts(date);
  return parts ? parts.year * 10000 + parts.month * 100 + parts.day : 0;
};

const getFinancialYearSortValue = fy => {
  const startYear = Number(String(fy || '').slice(0, 4));
  return Number.isFinite(startYear) ? startYear : 0;
};

const getMonthKey = date => {
  const parts = getDateParts(date);

  if (!parts || !parts.year || !parts.month) {
    return 'Unknown';
  }

  return `${parts.year}-${String(parts.month).padStart(2, '0')}`;
};

const getMonthSortValue = date => {
  const parts = getDateParts(date);
  return parts ? parts.year * 100 + parts.month : 0;
};

const formatCurrency = value => currencyFormatter.format(Number(value) || 0);
const formatNumber = value => numberFormatter.format(Number(value) || 0);

function FieldLabel({ children }) {
  return (
    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </label>
  );
}

function EmptyState({ title }) {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 text-sm font-medium text-slate-500">
      {title}
    </div>
  );
}

function StatusBadge({ children, tone = 'slate' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 ring-blue-200',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${tones[tone]}`}>
      {children}
    </span>
  );
}

function StatTile({ label, value, icon: Icon, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    slate: 'bg-slate-100 text-slate-700',
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
        </div>
        <div className={`flex size-11 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}

export default function NexusB2B() {
  const [activeTab, setActiveTab] = useState('entry');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState(createInitialForm);
  const [dropdowns, setDropdowns] = useState({ buyer: false, product: false, analyticsBuyer: false });
  const [financialYear, setFinancialYear] = useState('ALL');
  const [viewMode, setViewMode] = useState('Detailed Logs');
  const [analyticsBuyerSearch, setAnalyticsBuyerSearch] = useState('');
  const [selectedAnalyticsBuyerId, setSelectedAnalyticsBuyerId] = useState('');
  const [buyerProductFilter, setBuyerProductFilter] = useState('ALL');
  const [buyerDateRange, setBuyerDateRange] = useState('All Time');
  const [buyerGrouping, setBuyerGrouping] = useState('Year-wise');
  const [buyerViewMode, setBuyerViewMode] = useState('Detailed Logs');
  const [skuSearch, setSkuSearch] = useState('');
  const [skuDraftPrices, setSkuDraftPrices] = useState({});
  const [updatingSkuId, setUpdatingSkuId] = useState(null);
  const [status, setStatus] = useState(null);
  const [skus, setSkus] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [storageLogs, setStorageLogs] = useState([]);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      const data = await fetchMasterData();

      if (!isMounted) {
        return;
      }

      setSkus(data.skus);
      setSkuDraftPrices(Object.fromEntries(data.skus.map(sku => [sku.productId, String(sku.defaultPrice || '')])));
      setBuyers(data.buyers);
      setStorageLogs(data.logs);
      setStatus(data.error ? { type: 'error', message: data.error } : null);
      setIsLoading(false);
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const buyerMap = useMemo(() => new Map(buyers.map(buyer => [buyer.buyerId, buyer])), [buyers]);
  const skuMap = useMemo(() => new Map(skus.map(sku => [sku.productId, sku])), [skus]);

  const filteredBuyers = useMemo(() => {
    const query = normalize(form.buyerSearch);

    return buyers.filter(buyer => {
      const searchable = `${buyer.buyerId} ${buyer.companyName}`.toLowerCase();
      return !query || searchable.includes(query);
    });
  }, [buyers, form.buyerSearch]);

  const filteredSkus = useMemo(() => {
    const query = normalize(form.productSearch);

    return skus.filter(sku => {
      const searchable = `${sku.productId} ${sku.description}`.toLowerCase();
      return !query || searchable.includes(query);
    });
  }, [skus, form.productSearch]);

  const filteredAnalyticsBuyers = useMemo(() => {
    const query = normalize(analyticsBuyerSearch);

    return buyers.filter(buyer => {
      const searchable = `${buyer.buyerId} ${buyer.companyName}`.toLowerCase();
      return !query || searchable.includes(query);
    });
  }, [analyticsBuyerSearch, buyers]);

  const filteredSkuMasterRows = useMemo(() => {
    const query = normalize(skuSearch);

    return skus.filter(sku => {
      const searchable = `${sku.productId} ${sku.description}`.toLowerCase();
      return !query || searchable.includes(query);
    });
  }, [skuSearch, skus]);

  const enrichedLogs = useMemo(() => storageLogs.map(log => {
    const buyer = buyerMap.get(log.buyerId);
    const sku = skuMap.get(log.productId);
    const quantity = Number(log.quantity) || 0;
    const unitPrice = Number(log.unitPrice) || 0;

    return {
      ...log,
      companyName: buyer?.companyName || 'Unknown Buyer',
      description: sku?.description || 'Unknown Product',
      quantity,
      unitPrice,
      totalValue: quantity * unitPrice,
      fy: getFinancialYear(log.date),
      monthKey: getMonthKey(log.date),
    };
  }), [buyerMap, skuMap, storageLogs]);

  const dashboardLogs = useMemo(() => {
    const rows = financialYear === 'ALL'
      ? enrichedLogs
      : enrichedLogs.filter(log => log.fy === financialYear);

    return [...rows].sort((a, b) => getDateSortValue(b.date) - getDateSortValue(a.date));
  }, [enrichedLogs, financialYear]);

  const consolidatedRows = useMemo(() => {
    const grouped = new Map();

    dashboardLogs.forEach(log => {
      const key = `${log.fy}__${log.productId}`;
      const current = grouped.get(key) || {
        fy: log.fy,
        productId: log.productId,
        description: log.description,
        totalQty: 0,
        totalRevenue: 0,
        orderCount: 0,
      };

      current.totalQty += log.quantity;
      current.totalRevenue += log.totalValue;
      current.orderCount += 1;
      grouped.set(key, current);
    });

    return [...grouped.values()].sort((a, b) => {
      const fySort = getFinancialYearSortValue(b.fy) - getFinancialYearSortValue(a.fy);
      return fySort || b.totalRevenue - a.totalRevenue;
    });
  }, [dashboardLogs]);

  const allSortedLogs = useMemo(
    () => [...enrichedLogs].sort((a, b) => getDateSortValue(b.date) - getDateSortValue(a.date)),
    [enrichedLogs]
  );

  const buyerDateRangeOptions = useMemo(() => {
    const years = new Set(financialYears.filter(option => option !== 'ALL'));

    enrichedLogs.forEach(log => {
      if (log.fy && log.fy !== 'Unknown') {
        years.add(log.fy);
      }
    });

    return [
      'All Time',
      ...[...years].sort((a, b) => getFinancialYearSortValue(b) - getFinancialYearSortValue(a)),
    ];
  }, [enrichedLogs]);

  const selectedAnalyticsBuyer = buyerMap.get(selectedAnalyticsBuyerId);

  const buyerAnalyticsLogs = useMemo(() => {
    if (!selectedAnalyticsBuyerId) {
      return [];
    }

    return enrichedLogs
      .filter(log => log.buyerId === selectedAnalyticsBuyerId)
      .filter(log => buyerProductFilter === 'ALL' || log.productId === buyerProductFilter)
      .filter(log => buyerDateRange === 'All Time' || log.fy === buyerDateRange)
      .sort((a, b) => getDateSortValue(b.date) - getDateSortValue(a.date));
  }, [buyerDateRange, buyerProductFilter, enrichedLogs, selectedAnalyticsBuyerId]);

  const buyerConsolidatedRows = useMemo(() => {
    const grouped = new Map();
    const isMonthWise = buyerGrouping === 'Month-wise';

    buyerAnalyticsLogs.forEach(log => {
      const period = isMonthWise ? log.monthKey : log.fy;
      const periodSort = isMonthWise ? getMonthSortValue(log.date) : getFinancialYearSortValue(log.fy);
      const key = `${period}__${log.productId}`;
      const current = grouped.get(key) || {
        period,
        periodSort,
        productId: log.productId,
        description: log.description,
        totalQty: 0,
        totalRevenue: 0,
        lineCount: 0,
      };

      current.totalQty += log.quantity;
      current.totalRevenue += log.totalValue;
      current.lineCount += 1;
      grouped.set(key, current);
    });

    return [...grouped.values()].sort((a, b) => {
      const periodSort = b.periodSort - a.periodSort;
      return periodSort || b.totalRevenue - a.totalRevenue;
    });
  }, [buyerAnalyticsLogs, buyerGrouping]);

  const buyerAnalyticsStats = useMemo(() => {
    const revenue = buyerAnalyticsLogs.reduce((sum, log) => sum + log.totalValue, 0);
    const quantity = buyerAnalyticsLogs.reduce((sum, log) => sum + log.quantity, 0);
    const productCount = new Set(buyerAnalyticsLogs.map(log => log.productId).filter(Boolean)).size;

    return {
      revenue,
      quantity,
      productCount,
      orderCount: buyerAnalyticsLogs.length,
    };
  }, [buyerAnalyticsLogs]);

  const dashboardStats = useMemo(() => {
    const revenue = dashboardLogs.reduce((sum, log) => sum + log.totalValue, 0);
    const quantity = dashboardLogs.reduce((sum, log) => sum + log.quantity, 0);
    const buyerCount = new Set(dashboardLogs.map(log => log.buyerId).filter(Boolean)).size;

    return {
      revenue,
      quantity,
      buyerCount,
      orderCount: dashboardLogs.length,
    };
  }, [dashboardLogs]);

  const canSubmit = Boolean(
    form.date &&
    form.orderId &&
    form.buyerId &&
    form.productId &&
    form.quantity &&
    form.unitPrice &&
    !isSubmitting
  );

  const updateForm = changes => {
    setForm(prev => ({ ...prev, ...changes }));
  };

  const closeDropdownSoon = key => {
    window.setTimeout(() => {
      setDropdowns(prev => ({ ...prev, [key]: false }));
    }, 150);
  };

  const handleSubmit = async event => {
    event.preventDefault();

    if (!canSubmit) {
      setStatus({ type: 'error', message: 'Complete all required fields before submitting.' });
      return;
    }

    const newLog = {
      date: form.date,
      buyerId: form.buyerId,
      productId: form.productId,
      quantity: Number(form.quantity),
      unitPrice: Number(form.unitPrice),
      orderId: form.orderId,
      notes: form.notes,
    };

    setIsSubmitting(true);
    setStatus(null);
    setStorageLogs(prev => [newLog, ...prev]);

    const result = await appendOrderLog(newLog);

    if (!result.success) {
      setStorageLogs(prev => prev.filter(log => log !== newLog));
      setStatus({ type: 'error', message: result.error || 'Order could not be submitted.' });
      setIsSubmitting(false);
      return;
    }

    setForm(prev => ({
      ...prev,
      productSearch: '',
      productId: '',
      quantity: '',
      unitPrice: '',
      notes: '',
    }));
    setStatus({ type: 'success', message: 'Order line added to Storage.' });
    setIsSubmitting(false);
  };

  const selectAnalyticsBuyer = buyer => {
    setSelectedAnalyticsBuyerId(buyer.buyerId);
    setAnalyticsBuyerSearch(buyer.companyName);
    setDropdowns(prev => ({ ...prev, analyticsBuyer: false }));
  };

  const handleSkuPriceChange = (productId, value) => {
    setSkuDraftPrices(prev => ({ ...prev, [productId]: value }));
  };

  const handleSkuPriceUpdate = async sku => {
    const draftPrice = skuDraftPrices[sku.productId];
    const parsedPrice = Number(draftPrice);

    if (draftPrice === '' || !Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setStatus({ type: 'error', message: 'Enter a valid price before updating the SKU.' });
      return;
    }

    setUpdatingSkuId(sku.productId);
    setStatus(null);

    const result = await updateSkuPrice(sku.productId, parsedPrice);

    if (!result.success) {
      setStatus({ type: 'error', message: result.error || 'SKU price could not be updated.' });
      setUpdatingSkuId(null);
      return;
    }

    setSkus(prev => prev.map(item => (
      item.productId === sku.productId
        ? { ...item, defaultPrice: parsedPrice }
        : item
    )));
    setSkuDraftPrices(prev => ({ ...prev, [sku.productId]: String(parsedPrice) }));
    setForm(prev => (
      prev.productId === sku.productId
        ? { ...prev, unitPrice: String(parsedPrice) }
        : prev
    ));
    setStatus({ type: 'success', message: `${sku.productId} default price updated.` });
    setUpdatingSkuId(null);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-700">
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm font-semibold shadow-sm">
          <Loader2 className="animate-spin text-blue-600" size={20} />
          Connecting to Google Sheets...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-20 flex-col bg-slate-900 text-white shadow-xl lg:w-72">
        <div className="flex h-20 items-center border-b border-slate-800 px-4 lg:px-6">
          <div className="flex size-10 items-center justify-center rounded-lg bg-blue-600">
            <Building2 size={21} />
          </div>
          <div className="ml-3 hidden lg:block">
            <h1 className="text-lg font-bold tracking-wide">Nexus B2B</h1>
            <p className="text-xs font-medium text-slate-400">Sales and Inventory</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-5">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex w-full items-center justify-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold transition lg:justify-start lg:px-4 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
                title={item.label}
              >
                <Icon size={19} />
                <span className="hidden lg:inline">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="hidden border-t border-slate-800 p-5 lg:block">
          <div className="rounded-lg bg-slate-800 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Records</p>
            <p className="mt-2 text-2xl font-bold">{formatNumber(storageLogs.length)}</p>
          </div>
        </div>
      </aside>

      <main className="ml-20 min-h-screen p-4 lg:ml-72 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
                {navItems.find(item => item.id === activeTab)?.label}
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                B2B Sales Ledger
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              <StatusBadge tone="blue">{formatNumber(skus.length)} SKUs</StatusBadge>
              <StatusBadge tone="emerald">{formatNumber(buyers.length)} Buyers</StatusBadge>
              <StatusBadge tone="amber">{formatNumber(storageLogs.length)} Logs</StatusBadge>
            </div>
          </header>

          {status && (
            <div
              className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-semibold shadow-sm ${
                status.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              {status.message}
            </div>
          )}

          {activeTab === 'entry' && (
            <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <form onSubmit={handleSubmit} className="space-y-6 p-5 lg:p-6">
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <FieldLabel>Date</FieldLabel>
                    <input
                      type="date"
                      value={form.date}
                      onChange={event => updateForm({ date: event.target.value })}
                      className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <FieldLabel>Order ID</FieldLabel>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={form.orderId}
                        onChange={event => updateForm({ orderId: event.target.value })}
                        className="h-12 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                      />
                      <button
                        type="button"
                        onClick={() => updateForm({ orderId: createOrderId() })}
                        className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:border-blue-600 hover:text-blue-700"
                        title="Generate order ID"
                      >
                        <RefreshCw size={18} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(180px,0.6fr)]">
                  <div className="relative">
                    <FieldLabel>Buyer Search</FieldLabel>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="text"
                        value={form.buyerSearch}
                        onFocus={() => setDropdowns(prev => ({ ...prev, buyer: true }))}
                        onBlur={() => closeDropdownSoon('buyer')}
                        onChange={event => updateForm({ buyerSearch: event.target.value, buyerId: '' })}
                        className="h-12 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                      />
                    </div>

                    {dropdowns.buyer && (
                      <div className="absolute left-0 right-0 top-full z-10 mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                        {filteredBuyers.length ? filteredBuyers.map(buyer => (
                          <button
                            key={buyer.buyerId}
                            type="button"
                            onMouseDown={event => event.preventDefault()}
                            onClick={() => {
                              updateForm({ buyerId: buyer.buyerId, buyerSearch: buyer.companyName });
                              setDropdowns(prev => ({ ...prev, buyer: false }));
                            }}
                            className="flex w-full items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-blue-50"
                          >
                            <span>
                              <span className="block text-sm font-semibold text-slate-900">{buyer.companyName}</span>
                              <span className="text-xs font-medium text-slate-500">{buyer.poc || buyer.contactNumber}</span>
                            </span>
                            <span className="text-xs font-bold text-blue-700">{buyer.buyerId}</span>
                          </button>
                        )) : (
                          <div className="px-4 py-3 text-sm font-medium text-slate-500">No buyers found</div>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <FieldLabel>Selected Buyer ID</FieldLabel>
                    <input
                      type="text"
                      value={form.buyerId}
                      disabled
                      className="h-12 w-full rounded-lg border border-slate-200 bg-slate-100 px-4 text-sm font-bold text-slate-700"
                    />
                  </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(180px,0.6fr)]">
                  <div className="relative">
                    <FieldLabel>Product Search</FieldLabel>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="text"
                        value={form.productSearch}
                        onFocus={() => setDropdowns(prev => ({ ...prev, product: true }))}
                        onBlur={() => closeDropdownSoon('product')}
                        onChange={event => updateForm({
                          productSearch: event.target.value,
                          productId: '',
                          unitPrice: '',
                        })}
                        className="h-12 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                      />
                    </div>

                    {dropdowns.product && (
                      <div className="absolute left-0 right-0 top-full z-10 mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                        {filteredSkus.length ? filteredSkus.map(sku => (
                          <button
                            key={sku.productId}
                            type="button"
                            onMouseDown={event => event.preventDefault()}
                            onClick={() => {
                              updateForm({
                                productId: sku.productId,
                                productSearch: sku.description,
                                unitPrice: String(sku.defaultPrice || ''),
                              });
                              setDropdowns(prev => ({ ...prev, product: false }));
                            }}
                            className="flex w-full items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-blue-50"
                          >
                            <span>
                              <span className="block text-sm font-semibold text-slate-900">{sku.description}</span>
                              <span className="text-xs font-medium text-slate-500">{formatCurrency(sku.defaultPrice)}</span>
                            </span>
                            <span className="text-xs font-bold text-blue-700">{sku.productId}</span>
                          </button>
                        )) : (
                          <div className="px-4 py-3 text-sm font-medium text-slate-500">No products found</div>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <FieldLabel>Selected Product ID</FieldLabel>
                    <input
                      type="text"
                      value={form.productId}
                      disabled
                      className="h-12 w-full rounded-lg border border-slate-200 bg-slate-100 px-4 text-sm font-bold text-slate-700"
                    />
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-3">
                  <div>
                    <FieldLabel>Quantity</FieldLabel>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.quantity}
                      onChange={event => updateForm({ quantity: event.target.value })}
                      className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <FieldLabel>Unit Price</FieldLabel>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.unitPrice}
                      onChange={event => updateForm({ unitPrice: event.target.value })}
                      className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <FieldLabel>Notes</FieldLabel>
                    <input
                      type="text"
                      value={form.notes}
                      onChange={event => updateForm({ notes: event.target.value })}
                      placeholder="10% discount"
                      className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>
                </div>

                <div className="flex flex-col justify-between gap-4 border-t border-slate-200 pt-5 sm:flex-row sm:items-center">
                  <div className="text-sm font-semibold text-slate-600">
                    Line total:{' '}
                    <span className="text-slate-950">
                      {formatCurrency((Number(form.quantity) || 0) * (Number(form.unitPrice) || 0))}
                    </span>
                  </div>
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Submit
                  </button>
                </div>
              </form>
            </section>
          )}

          {activeTab === 'dashboard' && (
            <section className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <StatTile label="Revenue" value={formatCurrency(dashboardStats.revenue)} icon={BarChart3} tone="blue" />
                <StatTile label="Quantity" value={formatNumber(dashboardStats.quantity)} icon={Package} tone="emerald" />
                <StatTile label="Buyers" value={formatNumber(dashboardStats.buyerCount)} icon={Users} tone="amber" />
                <StatTile label="Logs" value={formatNumber(dashboardStats.orderCount)} icon={History} tone="slate" />
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <FieldLabel>Financial Year</FieldLabel>
                    <select
                      value={financialYear}
                      onChange={event => setFinancialYear(event.target.value)}
                      className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    >
                      {financialYears.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <FieldLabel>View Mode</FieldLabel>
                    <select
                      value={viewMode}
                      onChange={event => setViewMode(event.target.value)}
                      className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    >
                      {viewModes.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                {viewMode === 'Detailed Logs' ? (
                  dashboardLogs.length ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Order ID</th>
                            <th className="px-4 py-3">Buyer</th>
                            <th className="px-4 py-3">Product</th>
                            <th className="px-4 py-3 text-right">Qty</th>
                            <th className="px-4 py-3 text-right">Unit Price</th>
                            <th className="px-4 py-3 text-right">Total</th>
                            <th className="px-4 py-3">FY</th>
                            <th className="px-4 py-3">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {dashboardLogs.map((log, index) => (
                            <tr key={`${log.orderId}-${log.productId}-${index}`} className="hover:bg-slate-50">
                              <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">{log.date}</td>
                              <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">{log.orderId}</td>
                              <td className="px-4 py-3">{log.companyName}</td>
                              <td className="px-4 py-3">{log.description}</td>
                              <td className="px-4 py-3 text-right">{formatNumber(log.quantity)}</td>
                              <td className="px-4 py-3 text-right">{formatCurrency(log.unitPrice)}</td>
                              <td className="px-4 py-3 text-right font-bold text-slate-950">{formatCurrency(log.totalValue)}</td>
                              <td className="whitespace-nowrap px-4 py-3"><StatusBadge>{log.fy}</StatusBadge></td>
                              <td className="min-w-52 px-4 py-3 text-slate-600">{log.notes || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-5">
                      <EmptyState title="No dashboard records found" />
                    </div>
                  )
                ) : consolidatedRows.length ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Financial Year</th>
                          <th className="px-4 py-3">Product ID</th>
                          <th className="px-4 py-3">Product</th>
                          <th className="px-4 py-3 text-right">Total Qty</th>
                          <th className="px-4 py-3 text-right">Total Revenue</th>
                          <th className="px-4 py-3 text-right">Lines</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {consolidatedRows.map(row => (
                          <tr key={`${row.fy}-${row.productId}`} className="hover:bg-slate-50">
                            <td className="whitespace-nowrap px-4 py-3"><StatusBadge tone="blue">{row.fy}</StatusBadge></td>
                            <td className="whitespace-nowrap px-4 py-3 font-bold text-slate-900">{row.productId}</td>
                            <td className="px-4 py-3">{row.description}</td>
                            <td className="px-4 py-3 text-right">{formatNumber(row.totalQty)}</td>
                            <td className="px-4 py-3 text-right font-bold text-slate-950">{formatCurrency(row.totalRevenue)}</td>
                            <td className="px-4 py-3 text-right">{formatNumber(row.orderCount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-5">
                    <EmptyState title="No consolidated records found" />
                  </div>
                )}
              </div>
            </section>
          )}

          {activeTab === 'buyerAnalytics' && (
            <section className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <FieldLabel>Select Buyer</FieldLabel>
                  <div className="relative">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="text"
                        value={analyticsBuyerSearch}
                        onFocus={() => setDropdowns(prev => ({ ...prev, analyticsBuyer: true }))}
                        onBlur={() => closeDropdownSoon('analyticsBuyer')}
                        onChange={event => {
                          setAnalyticsBuyerSearch(event.target.value);
                          setSelectedAnalyticsBuyerId('');
                        }}
                        className="h-12 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                      />
                    </div>

                    {dropdowns.analyticsBuyer && (
                      <div className="absolute left-0 right-0 top-full z-10 mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                        {filteredAnalyticsBuyers.length ? filteredAnalyticsBuyers.map(buyer => (
                          <button
                            key={buyer.buyerId}
                            type="button"
                            onMouseDown={event => event.preventDefault()}
                            onClick={() => selectAnalyticsBuyer(buyer)}
                            className="flex w-full items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-blue-50"
                          >
                            <span>
                              <span className="block text-sm font-semibold text-slate-900">{buyer.companyName}</span>
                              <span className="text-xs font-medium text-slate-500">{buyer.poc || buyer.contactNumber}</span>
                            </span>
                            <span className="text-xs font-bold text-blue-700">{buyer.buyerId}</span>
                          </button>
                        )) : (
                          <div className="px-4 py-3 text-sm font-medium text-slate-500">No buyers found</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  {selectedAnalyticsBuyer ? (
                    <div>
                      <div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start">
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Buyer Profile</p>
                          <h3 className="mt-1 text-xl font-bold text-slate-950">{selectedAnalyticsBuyer.companyName}</h3>
                        </div>
                        <StatusBadge tone="blue">{selectedAnalyticsBuyer.buyerId}</StatusBadge>
                      </div>

                      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                        <div>
                          <p className="font-semibold text-slate-500">POC</p>
                          <p className="font-medium text-slate-900">{selectedAnalyticsBuyer.poc || '-'}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-500">Contact Number</p>
                          <p className="font-medium text-slate-900">{selectedAnalyticsBuyer.contactNumber || '-'}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-500">E-Mail</p>
                          <p className="font-medium text-slate-900">{selectedAnalyticsBuyer.email || '-'}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-500">GSTIN</p>
                          <p className="font-medium text-slate-900">{selectedAnalyticsBuyer.gstin || '-'}</p>
                        </div>
                        <div className="sm:col-span-2">
                          <p className="font-semibold text-slate-500">Address</p>
                          <p className="font-medium text-slate-900">{selectedAnalyticsBuyer.address || '-'}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <EmptyState title="Select a buyer to view their analytics profile" />
                  )}
                </div>
              </div>

              {selectedAnalyticsBuyer && (
                <>
                  <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="grid gap-4 lg:grid-cols-4">
                      <div>
                        <FieldLabel>Product Filter</FieldLabel>
                        <select
                          value={buyerProductFilter}
                          onChange={event => setBuyerProductFilter(event.target.value)}
                          className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                        >
                          <option value="ALL">All Products</option>
                          {skus.map(sku => (
                            <option key={sku.productId} value={sku.productId}>
                              {sku.productId} - {sku.description}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <FieldLabel>Date Range</FieldLabel>
                        <select
                          value={buyerDateRange}
                          onChange={event => setBuyerDateRange(event.target.value)}
                          className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                        >
                          {buyerDateRangeOptions.map(option => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <FieldLabel>Grouping</FieldLabel>
                        <div className="grid h-12 grid-cols-2 rounded-lg border border-slate-300 bg-slate-100 p-1">
                          {buyerGroupModes.map(option => (
                            <button
                              key={option}
                              type="button"
                              onClick={() => setBuyerGrouping(option)}
                              className={`rounded-md text-xs font-bold transition ${
                                buyerGrouping === option
                                  ? 'bg-white text-blue-700 shadow-sm'
                                  : 'text-slate-500 hover:text-slate-900'
                              }`}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <FieldLabel>View</FieldLabel>
                        <div className="grid h-12 grid-cols-2 rounded-lg border border-slate-300 bg-slate-100 p-1">
                          {buyerViewModes.map(option => (
                            <button
                              key={option}
                              type="button"
                              onClick={() => setBuyerViewMode(option)}
                              className={`rounded-md text-xs font-bold transition ${
                                buyerViewMode === option
                                  ? 'bg-white text-blue-700 shadow-sm'
                                  : 'text-slate-500 hover:text-slate-900'
                              }`}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-4">
                    <StatTile label="Buyer Revenue" value={formatCurrency(buyerAnalyticsStats.revenue)} icon={BarChart3} tone="blue" />
                    <StatTile label="Quantity" value={formatNumber(buyerAnalyticsStats.quantity)} icon={Package} tone="emerald" />
                    <StatTile label="Products" value={formatNumber(buyerAnalyticsStats.productCount)} icon={Package} tone="amber" />
                    <StatTile label="Lines" value={formatNumber(buyerAnalyticsStats.orderCount)} icon={History} tone="slate" />
                  </div>

                  <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                    {buyerViewMode === 'Detailed Logs' ? (
                      buyerAnalyticsLogs.length ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-slate-200 text-sm">
                            <thead className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                              <tr>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Order ID</th>
                                <th className="px-4 py-3">Product ID</th>
                                <th className="px-4 py-3">Product</th>
                                <th className="px-4 py-3 text-right">Qty</th>
                                <th className="px-4 py-3 text-right">Unit Price</th>
                                <th className="px-4 py-3 text-right">Total</th>
                                <th className="px-4 py-3">FY</th>
                                <th className="px-4 py-3">Notes</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {buyerAnalyticsLogs.map((log, index) => (
                                <tr key={`${log.orderId}-${log.productId}-${index}`} className="hover:bg-slate-50">
                                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">{log.date}</td>
                                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">{log.orderId}</td>
                                  <td className="whitespace-nowrap px-4 py-3">{log.productId}</td>
                                  <td className="px-4 py-3">{log.description}</td>
                                  <td className="px-4 py-3 text-right">{formatNumber(log.quantity)}</td>
                                  <td className="px-4 py-3 text-right">{formatCurrency(log.unitPrice)}</td>
                                  <td className="px-4 py-3 text-right font-bold text-slate-950">{formatCurrency(log.totalValue)}</td>
                                  <td className="whitespace-nowrap px-4 py-3"><StatusBadge>{log.fy}</StatusBadge></td>
                                  <td className="min-w-52 px-4 py-3 text-slate-600">{log.notes || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="p-5">
                          <EmptyState title="No buyer transactions match the selected filters" />
                        </div>
                      )
                    ) : buyerConsolidatedRows.length ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                          <thead className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                            <tr>
                              <th className="px-4 py-3">{buyerGrouping === 'Month-wise' ? 'Month' : 'Financial Year'}</th>
                              <th className="px-4 py-3">Product ID</th>
                              <th className="px-4 py-3">Product</th>
                              <th className="px-4 py-3 text-right">Total Qty</th>
                              <th className="px-4 py-3 text-right">Total Revenue</th>
                              <th className="px-4 py-3 text-right">Lines</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {buyerConsolidatedRows.map(row => (
                              <tr key={`${row.period}-${row.productId}`} className="hover:bg-slate-50">
                                <td className="whitespace-nowrap px-4 py-3"><StatusBadge tone="blue">{row.period}</StatusBadge></td>
                                <td className="whitespace-nowrap px-4 py-3 font-bold text-slate-900">{row.productId}</td>
                                <td className="px-4 py-3">{row.description}</td>
                                <td className="px-4 py-3 text-right">{formatNumber(row.totalQty)}</td>
                                <td className="px-4 py-3 text-right font-bold text-slate-950">{formatCurrency(row.totalRevenue)}</td>
                                <td className="px-4 py-3 text-right">{formatNumber(row.lineCount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-5">
                        <EmptyState title="No consolidated buyer records found" />
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>
          )}

          {activeTab === 'logs' && (
            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              {allSortedLogs.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Order ID</th>
                        <th className="px-4 py-3">Buyer ID</th>
                        <th className="px-4 py-3">Company</th>
                        <th className="px-4 py-3">Product ID</th>
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3 text-right">Qty</th>
                        <th className="px-4 py-3 text-right">Unit Price</th>
                        <th className="px-4 py-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {allSortedLogs.map((log, index) => (
                        <tr key={`${log.orderId}-${log.productId}-${index}`} className="hover:bg-slate-50">
                          <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">{log.date}</td>
                          <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">{log.orderId}</td>
                          <td className="whitespace-nowrap px-4 py-3">{log.buyerId}</td>
                          <td className="px-4 py-3">{log.companyName}</td>
                          <td className="whitespace-nowrap px-4 py-3">{log.productId}</td>
                          <td className="px-4 py-3">{log.description}</td>
                          <td className="px-4 py-3 text-right">{formatNumber(log.quantity)}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(log.unitPrice)}</td>
                          <td className="min-w-52 px-4 py-3 text-slate-600">{log.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-5">
                  <EmptyState title="No storage logs found" />
                </div>
              )}
            </section>
          )}

          {activeTab === 'skus' && (
            <section className="space-y-5">
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <FieldLabel>Search SKUs</FieldLabel>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={skuSearch}
                    onChange={event => setSkuSearch(event.target.value)}
                    className="h-12 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                {filteredSkuMasterRows.length ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Product ID</th>
                          <th className="px-4 py-3">Product Description</th>
                          <th className="px-4 py-3">Default Price</th>
                          <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredSkuMasterRows.map(sku => (
                          <tr key={sku.productId} className="hover:bg-slate-50">
                            <td className="whitespace-nowrap px-4 py-3 font-bold text-slate-900">{sku.productId}</td>
                            <td className="min-w-72 px-4 py-3">{sku.description}</td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={skuDraftPrices[sku.productId] ?? ''}
                                onChange={event => handleSkuPriceChange(sku.productId, event.target.value)}
                                className="h-10 w-40 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                              />
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleSkuPriceUpdate(sku)}
                                disabled={Boolean(updatingSkuId)}
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                              >
                                {updatingSkuId === sku.productId ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                Update
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-5">
                    <EmptyState title="No SKU records found" />
                  </div>
                )}
              </div>
            </section>
          )}

          {activeTab === 'buyers' && (
            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              {buyers.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Buyer ID</th>
                        <th className="px-4 py-3">Company Name</th>
                        <th className="px-4 py-3">POC</th>
                        <th className="px-4 py-3">Contact Number</th>
                        <th className="px-4 py-3">E-Mail</th>
                        <th className="px-4 py-3">GSTIN</th>
                        <th className="px-4 py-3">Address</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {buyers.map(buyer => (
                        <tr key={buyer.buyerId} className="hover:bg-slate-50">
                          <td className="whitespace-nowrap px-4 py-3 font-bold text-slate-900">{buyer.buyerId}</td>
                          <td className="px-4 py-3 font-semibold text-slate-900">{buyer.companyName}</td>
                          <td className="px-4 py-3">{buyer.poc}</td>
                          <td className="whitespace-nowrap px-4 py-3">{buyer.contactNumber}</td>
                          <td className="whitespace-nowrap px-4 py-3">{buyer.email}</td>
                          <td className="whitespace-nowrap px-4 py-3">{buyer.gstin}</td>
                          <td className="min-w-72 px-4 py-3">{buyer.address}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-5">
                  <EmptyState title="No buyer records found" />
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
