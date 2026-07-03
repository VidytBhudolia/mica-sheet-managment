'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Building2,
  Check,
  CheckCircle2,
  History,
  LayoutDashboard,
  Loader2,
  Package,
  PlusCircle,
  RefreshCw,
  Save,
  Search,
  StickyNote,
  Users,
  X,
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
const dashboardGroupModes = ['Annually', 'Monthly'];
const viewModes = ['Detailed Logs', 'Consolidated View'];
const buyerViewModes = ['Detailed Logs', 'Consolidated'];
const buyerGroupModes = ['Year-wise', 'Month-wise'];
const sortFields = [
  { key: 'productId', label: 'Product ID' },
  { key: 'totalQty', label: 'Qty' },
  { key: 'totalRevenue', label: 'Revenue' },
  { key: 'orderCount', label: 'Lines' },
];

const currencyFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const numberFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const createOrderId = () => `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
const getToday = () => new Date().toISOString().split('T')[0];
const normalize = value => String(value || '').toLowerCase().trim();
const formatCurrency = value => currencyFormatter.format(Number(value) || 0);
const formatNumber = value => numberFormatter.format(Number(value) || 0);

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
  if (isoMatch) return { year: Number(isoMatch[1]), month: Number(isoMatch[2]), day: Number(isoMatch[3]) };
  const slashMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slashMatch) return { year: Number(slashMatch[3]), month: Number(slashMatch[2]), day: Number(slashMatch[1]) };
  return null;
};

const getFinancialYear = date => {
  const parts = getDateParts(date);
  if (!parts || !parts.year || !parts.month) return 'Unknown';
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
  if (!parts || !parts.year || !parts.month) return 'Unknown';
  return `${parts.year}-${String(parts.month).padStart(2, '0')}`;
};

const getMonthSortValue = date => {
  const parts = getDateParts(date);
  return parts ? parts.year * 100 + parts.month : 0;
};

const getMonthLabel = monthKey => {
  if (!monthKey || monthKey === 'Unknown') return 'Unknown';
  const [year, month] = monthKey.split('-');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[Number(month) - 1]} ${year}`;
};


function FieldLabel({ children }) {
  return <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</label>;
}

function EmptyState({ title }) {
  return <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 text-sm font-medium text-slate-500">{title}</div>;
}

function NotePopup({ note, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="mx-4 w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-slate-900 whitespace-pre-wrap">{note}</p>
          <button type="button" onClick={onClose} className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={16} /></button>
        </div>
      </div>
    </div>
  );
}

function SortButton({ label, sortKey, activeSort, onToggle }) {
  const isActive = activeSort.key === sortKey;
  return (
    <button
      type="button"
      onClick={() => onToggle(sortKey)}
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-bold transition ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
    >
      {label}
      {isActive ? (activeSort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUp size={12} className="opacity-30" />}
    </button>
  );
}

function StatusBadge({ children, tone = 'slate' }) {
  const tones = { blue: 'bg-blue-50 text-blue-700 ring-blue-200', emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200', amber: 'bg-amber-50 text-amber-700 ring-amber-200', slate: 'bg-slate-100 text-slate-700 ring-slate-200' };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${tones[tone]}`}>{children}</span>;
}

function StatTile({ label, value, icon: Icon, tone = 'blue' }) {
  const tones = { blue: 'bg-blue-50 text-blue-700', emerald: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700', slate: 'bg-slate-100 text-slate-700' };
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500 sm:text-sm">{label}</p>
          <p className="mt-1 text-lg font-bold text-slate-900 sm:mt-2 sm:text-2xl">{value}</p>
        </div>
        <div className={`hidden sm:flex size-11 items-center justify-center rounded-lg ${tones[tone]}`}><Icon size={22} /></div>
      </div>
    </div>
  );
}

function NoteCell({ notes, onView }) {
  if (!notes) return null;
  return (
    <button type="button" onClick={() => onView(notes)} className="inline-flex items-center justify-center rounded-md p-1 text-amber-600 hover:bg-amber-50" title="View note">
      <StickyNote size={15} />
    </button>
  );
}

export default function NexusB2B() {
  const [activeTab, setActiveTab] = useState('entry');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState(createInitialForm);
  const [dropdowns, setDropdowns] = useState({ buyer: false, product: false, analyticsBuyer: false, buyerProduct: false });
  const [financialYear, setFinancialYear] = useState('ALL');
  const [viewMode, setViewMode] = useState('Detailed Logs');
  const [dashboardGrouping, setDashboardGrouping] = useState('Annually');
  const [dashboardSort, setDashboardSort] = useState({ key: 'totalRevenue', dir: 'desc' });
  const [analyticsBuyerSearch, setAnalyticsBuyerSearch] = useState('');
  const [selectedAnalyticsBuyerId, setSelectedAnalyticsBuyerId] = useState('');
  const [buyerProductFilter, setBuyerProductFilter] = useState('ALL');
  const [buyerProductSearch, setBuyerProductSearch] = useState('');
  const [buyerDateRange, setBuyerDateRange] = useState('All Time');
  const [buyerGrouping, setBuyerGrouping] = useState('Year-wise');
  const [buyerViewMode, setBuyerViewMode] = useState('Detailed Logs');
  const [buyerSort, setBuyerSort] = useState({ key: 'totalRevenue', dir: 'desc' });
  const [skuSearch, setSkuSearch] = useState('');
  const [editingSkuId, setEditingSkuId] = useState(null);
  const [editingSkuPrice, setEditingSkuPrice] = useState('');
  const [updatingSkuId, setUpdatingSkuId] = useState(null);
  const [status, setStatus] = useState(null);
  const [skus, setSkus] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [storageLogs, setStorageLogs] = useState([]);
  const [visibleNote, setVisibleNote] = useState(null);
  const [mobileNav, setMobileNav] = useState(false);

  const skuInputRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const data = await fetchMasterData();
        if (!isMounted) return;
        setSkus(data.skus);
        setBuyers(data.buyers);
        setStorageLogs(data.logs);
        setStatus(data.error ? { type: 'error', message: data.error } : null);
      } catch {
        if (isMounted) setStatus({ type: 'error', message: 'Unable to connect to Google Sheets. Check credentials.' });
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (editingSkuId && skuInputRef.current) skuInputRef.current.focus();
  }, [editingSkuId]);

  const buyerMap = useMemo(() => new Map(buyers.map(b => [b.buyerId, b])), [buyers]);
  const skuMap = useMemo(() => new Map(skus.map(s => [s.productId, s])), [skus]);

  const lastPriceMap = useMemo(() => {
    const map = new Map();
    skus.forEach(sku => { if (sku.defaultPrice > 0) map.set(sku.productId, sku.defaultPrice); });
    return map;
  }, [skus]);

  const filteredBuyers = useMemo(() => {
    const q = normalize(form.buyerSearch);
    return buyers.filter(b => !q || `${b.buyerId} ${b.companyName}`.toLowerCase().includes(q));
  }, [buyers, form.buyerSearch]);

  const filteredSkus = useMemo(() => {
    const q = normalize(form.productSearch);
    return skus.filter(s => !q || `${s.productId} ${s.description}`.toLowerCase().includes(q));
  }, [skus, form.productSearch]);

  const filteredAnalyticsBuyers = useMemo(() => {
    const q = normalize(analyticsBuyerSearch);
    return buyers.filter(b => !q || `${b.buyerId} ${b.companyName}`.toLowerCase().includes(q));
  }, [analyticsBuyerSearch, buyers]);

  const filteredBuyerProducts = useMemo(() => {
    const q = normalize(buyerProductSearch);
    return skus.filter(s => !q || `${s.productId} ${s.description}`.toLowerCase().includes(q));
  }, [skus, buyerProductSearch]);

  const filteredSkuMasterRows = useMemo(() => {
    const q = normalize(skuSearch);
    return skus.filter(s => !q || `${s.productId} ${s.description}`.toLowerCase().includes(q));
  }, [skuSearch, skus]);

  const enrichedLogs = useMemo(() => storageLogs.map(log => {
    const buyer = buyerMap.get(log.buyerId);
    const sku = skuMap.get(log.productId);
    const quantity = Number(log.quantity) || 0;
    const unitPrice = Number(log.unitPrice) || 0;
    return { ...log, companyName: buyer?.companyName || 'Unknown Buyer', description: sku?.description || 'Unknown Product', quantity, unitPrice, totalValue: quantity * unitPrice, fy: getFinancialYear(log.date), monthKey: getMonthKey(log.date) };
  }), [buyerMap, skuMap, storageLogs]);

  const dashboardLogs = useMemo(() => {
    const rows = financialYear === 'ALL' ? enrichedLogs : enrichedLogs.filter(l => l.fy === financialYear);
    return [...rows].sort((a, b) => getDateSortValue(b.date) - getDateSortValue(a.date));
  }, [enrichedLogs, financialYear]);

  const consolidatedRows = useMemo(() => {
    const grouped = new Map();
    const isMonthly = dashboardGrouping === 'Monthly';
    dashboardLogs.forEach(log => {
      const period = isMonthly ? log.monthKey : log.fy;
      const periodSort = isMonthly ? getMonthSortValue(log.date) : getFinancialYearSortValue(log.fy);
      const key = `${period}__${log.productId}`;
      const cur = grouped.get(key) || { period, periodSort, productId: log.productId, description: log.description, totalQty: 0, totalRevenue: 0, orderCount: 0 };
      cur.totalQty += log.quantity;
      cur.totalRevenue += log.totalValue;
      cur.orderCount += 1;
      grouped.set(key, cur);
    });
    return [...grouped.values()].sort((a, b) => b.periodSort - a.periodSort || b.totalRevenue - a.totalRevenue);
  }, [dashboardLogs, dashboardGrouping]);

  const allSortedLogs = useMemo(() => [...enrichedLogs].sort((a, b) => getDateSortValue(b.date) - getDateSortValue(a.date)), [enrichedLogs]);

  const dashboardLogsByPeriod = useMemo(() => {
    const groups = [];
    let ck = null, cg = null;
    dashboardLogs.forEach(log => {
      const key = dashboardGrouping === 'Monthly' ? log.monthKey : log.fy;
      if (key !== ck) { ck = key; cg = { key, label: dashboardGrouping === 'Monthly' ? getMonthLabel(key) : key, logs: [] }; groups.push(cg); }
      cg.logs.push(log);
    });
    return groups;
  }, [dashboardLogs, dashboardGrouping]);

  const dashboardConsolidatedByPeriod = useMemo(() => {
    const groups = [];
    let cp = null, cg = null;
    const sorted = [...consolidatedRows];
    // Apply secondary sort within same period
    sorted.sort((a, b) => {
      const ps = b.periodSort - a.periodSort;
      if (ps !== 0) return ps;
      const { key, dir } = dashboardSort;
      const av = key === 'productId' ? a[key] : Number(a[key]) || 0;
      const bv = key === 'productId' ? b[key] : Number(b[key]) || 0;
      if (key === 'productId') return dir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      return dir === 'asc' ? av - bv : bv - av;
    });
    sorted.forEach(row => {
      if (row.period !== cp) { cp = row.period; cg = { key: row.period, label: dashboardGrouping === 'Monthly' ? getMonthLabel(row.period) : row.period, rows: [] }; groups.push(cg); }
      cg.rows.push(row);
    });
    return groups;
  }, [consolidatedRows, dashboardGrouping, dashboardSort]);

  const buyerDateRangeOptions = useMemo(() => {
    const years = new Set(financialYears.filter(o => o !== 'ALL'));
    enrichedLogs.forEach(l => { if (l.fy && l.fy !== 'Unknown') years.add(l.fy); });
    return ['All Time', ...[...years].sort((a, b) => getFinancialYearSortValue(b) - getFinancialYearSortValue(a))];
  }, [enrichedLogs]);

  const selectedAnalyticsBuyer = buyerMap.get(selectedAnalyticsBuyerId);

  const buyerAnalyticsLogs = useMemo(() => {
    if (!selectedAnalyticsBuyerId) return [];
    return enrichedLogs
      .filter(l => l.buyerId === selectedAnalyticsBuyerId)
      .filter(l => buyerProductFilter === 'ALL' || l.productId === buyerProductFilter)
      .filter(l => buyerDateRange === 'All Time' || l.fy === buyerDateRange)
      .sort((a, b) => getDateSortValue(b.date) - getDateSortValue(a.date));
  }, [buyerDateRange, buyerProductFilter, enrichedLogs, selectedAnalyticsBuyerId]);

  const buyerConsolidatedRows = useMemo(() => {
    const grouped = new Map();
    const isMW = buyerGrouping === 'Month-wise';
    buyerAnalyticsLogs.forEach(log => {
      const period = isMW ? log.monthKey : log.fy;
      const periodSort = isMW ? getMonthSortValue(log.date) : getFinancialYearSortValue(log.fy);
      const key = `${period}__${log.productId}`;
      const cur = grouped.get(key) || { period, periodSort, productId: log.productId, description: log.description, totalQty: 0, totalRevenue: 0, orderCount: 0 };
      cur.totalQty += log.quantity;
      cur.totalRevenue += log.totalValue;
      cur.orderCount += 1;
      grouped.set(key, cur);
    });
    return [...grouped.values()].sort((a, b) => b.periodSort - a.periodSort || b.totalRevenue - a.totalRevenue);
  }, [buyerAnalyticsLogs, buyerGrouping]);

  const buyerLogsByPeriod = useMemo(() => {
    const groups = [];
    let ck = null, cg = null;
    buyerAnalyticsLogs.forEach(log => {
      const key = buyerGrouping === 'Month-wise' ? log.monthKey : log.fy;
      if (key !== ck) { ck = key; cg = { key, label: buyerGrouping === 'Month-wise' ? getMonthLabel(key) : key, logs: [] }; groups.push(cg); }
      cg.logs.push(log);
    });
    return groups;
  }, [buyerAnalyticsLogs, buyerGrouping]);

  const buyerConsolidatedByPeriod = useMemo(() => {
    const groups = [];
    let cp = null, cg = null;
    const sorted = [...buyerConsolidatedRows];
    sorted.sort((a, b) => {
      const ps = b.periodSort - a.periodSort;
      if (ps !== 0) return ps;
      const { key, dir } = buyerSort;
      const av = key === 'productId' ? a[key] : Number(a[key]) || 0;
      const bv = key === 'productId' ? b[key] : Number(b[key]) || 0;
      if (key === 'productId') return dir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      return dir === 'asc' ? av - bv : bv - av;
    });
    sorted.forEach(row => {
      if (row.period !== cp) { cp = row.period; cg = { key: row.period, label: buyerGrouping === 'Month-wise' ? getMonthLabel(row.period) : row.period, rows: [] }; groups.push(cg); }
      cg.rows.push(row);
    });
    return groups;
  }, [buyerConsolidatedRows, buyerGrouping, buyerSort]);

  const buyerAnalyticsStats = useMemo(() => {
    const revenue = buyerAnalyticsLogs.reduce((s, l) => s + l.totalValue, 0);
    const quantity = buyerAnalyticsLogs.reduce((s, l) => s + l.quantity, 0);
    const productCount = new Set(buyerAnalyticsLogs.map(l => l.productId).filter(Boolean)).size;
    return { revenue, quantity, productCount, orderCount: buyerAnalyticsLogs.length };
  }, [buyerAnalyticsLogs]);

  const dashboardStats = useMemo(() => {
    const revenue = dashboardLogs.reduce((s, l) => s + l.totalValue, 0);
    const quantity = dashboardLogs.reduce((s, l) => s + l.quantity, 0);
    const buyerCount = new Set(dashboardLogs.map(l => l.buyerId).filter(Boolean)).size;
    return { revenue, quantity, buyerCount, orderCount: dashboardLogs.length };
  }, [dashboardLogs]);

  const canSubmit = Boolean(form.date && form.orderId && form.buyerId && form.productId && form.quantity && form.unitPrice && !isSubmitting);
  const updateForm = changes => setForm(prev => ({ ...prev, ...changes }));
  const closeDropdownSoon = key => { window.setTimeout(() => setDropdowns(prev => ({ ...prev, [key]: false })), 150); };

  const toggleSort = (setter) => (key) => {
    setter(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' });
  };

  const handleSubmit = async event => {
    event.preventDefault();
    if (!canSubmit) { setStatus({ type: 'error', message: 'Complete all required fields before submitting.' }); return; }
    const newLog = { date: form.date, buyerId: form.buyerId, productId: form.productId, quantity: Number(form.quantity), unitPrice: Number(form.unitPrice), orderId: form.orderId, notes: form.notes };
    setIsSubmitting(true);
    setStatus(null);
    setStorageLogs(prev => [newLog, ...prev]);
    const result = await appendOrderLog(newLog);
    if (!result.success) {
      setStorageLogs(prev => prev.filter(l => l !== newLog));
      setStatus({ type: 'error', message: result.error || 'Order could not be submitted.' });
      setIsSubmitting(false);
      return;
    }
    if (newLog.unitPrice > 0) setSkus(prev => prev.map(s => s.productId === newLog.productId ? { ...s, defaultPrice: newLog.unitPrice } : s));
    setForm(prev => ({ ...prev, productSearch: '', productId: '', quantity: '', unitPrice: '', notes: '' }));
    setStatus({ type: 'success', message: 'Order line added to Storage.' });
    setIsSubmitting(false);
  };

  const selectAnalyticsBuyer = buyer => {
    setSelectedAnalyticsBuyerId(buyer.buyerId);
    setAnalyticsBuyerSearch(buyer.companyName);
    setDropdowns(prev => ({ ...prev, analyticsBuyer: false }));
  };

  const startEditSku = (sku) => {
    setEditingSkuId(sku.productId);
    setEditingSkuPrice(String(sku.defaultPrice || ''));
  };

  const handleSkuPriceSave = async (productId) => {
    const parsedPrice = Number(editingSkuPrice);
    if (editingSkuPrice === '' || !Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setStatus({ type: 'error', message: 'Enter a valid price.' });
      return;
    }
    setUpdatingSkuId(productId);
    setStatus(null);
    const result = await updateSkuPrice(productId, parsedPrice);
    if (!result.success) { setStatus({ type: 'error', message: result.error || 'Price could not be updated.' }); setUpdatingSkuId(null); return; }
    setSkus(prev => prev.map(s => s.productId === productId ? { ...s, defaultPrice: parsedPrice } : s));
    setStatus({ type: 'success', message: `${productId} price updated.` });
    setEditingSkuId(null);
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
      {/* Mobile nav overlay */}
      {mobileNav && (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setMobileNav(false)}>
          <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex h-16 items-center border-b border-slate-800 px-4">
              <Building2 size={20} className="text-blue-400" />
              <h1 className="ml-3 text-lg font-bold">Nexus B2B</h1>
            </div>
            <nav className="space-y-1 px-3 py-4">
              {navItems.map(item => {
                const Icon = item.icon;
                return (
                  <button key={item.id} type="button" onClick={() => { setActiveTab(item.id); setMobileNav(false); }}
                    className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition ${activeTab === item.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                    <Icon size={18} />{item.label}
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col bg-slate-900 text-white shadow-xl lg:flex">
        <div className="flex h-20 items-center border-b border-slate-800 px-6">
          <div className="flex size-10 items-center justify-center rounded-lg bg-blue-600"><Building2 size={21} /></div>
          <div className="ml-3">
            <h1 className="text-lg font-bold tracking-wide">Nexus B2B</h1>
            <p className="text-xs font-medium text-slate-400">Sales and Inventory</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-5">
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <button key={item.id} type="button" onClick={() => setActiveTab(item.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition ${activeTab === item.id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                <Icon size={19} /><span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="border-t border-slate-800 p-5">
          <div className="rounded-lg bg-slate-800 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Records</p>
            <p className="mt-2 text-2xl font-bold">{formatNumber(storageLogs.length)}</p>
          </div>
        </div>
      </aside>

      <main className="min-h-screen p-3 sm:p-4 lg:ml-72 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-5">
          {/* Mobile header */}
          <header className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4 lg:pb-6">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setMobileNav(true)} className="rounded-lg border border-slate-300 p-2 text-slate-600 lg:hidden"><Package size={18} /></button>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 sm:text-sm">{navItems.find(i => i.id === activeTab)?.label}</p>
                <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950 sm:text-3xl">B2B Sales Ledger</h2>
              </div>
            </div>
            <div className="hidden flex-wrap gap-2 sm:flex">
              <StatusBadge tone="blue">{formatNumber(skus.length)} SKUs</StatusBadge>
              <StatusBadge tone="emerald">{formatNumber(buyers.length)} Buyers</StatusBadge>
              <StatusBadge tone="amber">{formatNumber(storageLogs.length)} Logs</StatusBadge>
            </div>
          </header>

          {status && (
            <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-semibold shadow-sm ${status.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
              {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              {status.message}
            </div>
          )}


          {/* DATA ENTRY */}
          {activeTab === 'entry' && (
            <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <form onSubmit={handleSubmit} className="space-y-5 p-4 sm:p-5 lg:p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <FieldLabel>Date</FieldLabel>
                    <input type="date" value={form.date} onChange={e => updateForm({ date: e.target.value })} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
                  </div>
                  <div>
                    <FieldLabel>Order ID</FieldLabel>
                    <div className="flex gap-2">
                      <input type="text" value={form.orderId} onChange={e => updateForm({ orderId: e.target.value })} className="h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
                      <button type="button" onClick={() => updateForm({ orderId: createOrderId() })} className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:border-blue-600 hover:text-blue-700" title="Generate"><RefreshCw size={16} /></button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(140px,0.5fr)]">
                  <div className="relative">
                    <FieldLabel>Buyer Search</FieldLabel>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input type="text" value={form.buyerSearch} onFocus={() => setDropdowns(p => ({ ...p, buyer: true }))} onBlur={() => closeDropdownSoon('buyer')} onChange={e => updateForm({ buyerSearch: e.target.value, buyerId: '' })} className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
                    </div>
                    {dropdowns.buyer && (
                      <div className="absolute left-0 right-0 top-full z-10 mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                        {filteredBuyers.length ? filteredBuyers.map(b => (
                          <button key={b.buyerId} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { updateForm({ buyerId: b.buyerId, buyerSearch: b.companyName }); setDropdowns(p => ({ ...p, buyer: false })); }}
                            className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5 text-left transition last:border-b-0 hover:bg-blue-50">
                            <span><span className="block text-sm font-semibold text-slate-900">{b.companyName}</span><span className="text-xs text-slate-500">{b.poc || b.contactNumber}</span></span>
                            <span className="text-xs font-bold text-blue-700">{b.buyerId}</span>
                          </button>
                        )) : <div className="px-4 py-3 text-sm text-slate-500">No buyers found</div>}
                      </div>
                    )}
                  </div>
                  <div>
                    <FieldLabel>Buyer ID</FieldLabel>
                    <input type="text" value={form.buyerId} disabled className="h-11 w-full rounded-lg border border-slate-200 bg-slate-100 px-4 text-sm font-bold text-slate-700" />
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(140px,0.5fr)]">
                  <div className="relative">
                    <FieldLabel>Product Search</FieldLabel>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input type="text" value={form.productSearch} onFocus={() => setDropdowns(p => ({ ...p, product: true }))} onBlur={() => closeDropdownSoon('product')} onChange={e => updateForm({ productSearch: e.target.value, productId: '', unitPrice: '' })} className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
                    </div>
                    {dropdowns.product && (
                      <div className="absolute left-0 right-0 top-full z-10 mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                        {filteredSkus.length ? filteredSkus.map(s => (
                          <button key={s.productId} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { updateForm({ productId: s.productId, productSearch: s.description, unitPrice: String(lastPriceMap.get(s.productId) || s.defaultPrice || '') }); setDropdowns(p => ({ ...p, product: false })); }}
                            className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5 text-left transition last:border-b-0 hover:bg-blue-50">
                            <span><span className="block text-sm font-semibold text-slate-900">{s.description}</span><span className="text-xs text-slate-500">{formatCurrency(lastPriceMap.get(s.productId) || s.defaultPrice)}</span></span>
                            <span className="text-xs font-bold text-blue-700">{s.productId}</span>
                          </button>
                        )) : <div className="px-4 py-3 text-sm text-slate-500">No products found</div>}
                      </div>
                    )}
                  </div>
                  <div>
                    <FieldLabel>Product ID</FieldLabel>
                    <input type="text" value={form.productId} disabled className="h-11 w-full rounded-lg border border-slate-200 bg-slate-100 px-4 text-sm font-bold text-slate-700" />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <FieldLabel>Quantity</FieldLabel>
                    <input type="number" min="0" step="0.01" value={form.quantity} onChange={e => updateForm({ quantity: e.target.value })} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
                  </div>
                  <div>
                    <FieldLabel>Unit Price</FieldLabel>
                    <input type="number" min="0" step="0.01" value={form.unitPrice} onChange={e => updateForm({ unitPrice: e.target.value })} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
                  </div>
                  <div>
                    <FieldLabel>Notes</FieldLabel>
                    <input type="text" value={form.notes} onChange={e => updateForm({ notes: e.target.value })} placeholder="Optional" className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
                  </div>
                </div>

                <div className="flex flex-col justify-between gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center">
                  <div className="text-sm font-semibold text-slate-600">Total: <span className="text-slate-950">{formatCurrency((Number(form.quantity) || 0) * (Number(form.unitPrice) || 0))}</span></div>
                  <button type="submit" disabled={!canSubmit} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                    {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}Submit
                  </button>
                </div>
              </form>
            </section>
          )}


          {/* DASHBOARD */}
          {activeTab === 'dashboard' && (
            <section className="space-y-5">
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                <StatTile label="Revenue" value={formatCurrency(dashboardStats.revenue)} icon={BarChart3} tone="blue" />
                <StatTile label="Quantity" value={formatNumber(dashboardStats.quantity)} icon={Package} tone="emerald" />
                <StatTile label="Buyers" value={formatNumber(dashboardStats.buyerCount)} icon={Users} tone="amber" />
                <StatTile label="Logs" value={formatNumber(dashboardStats.orderCount)} icon={History} tone="slate" />
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <FieldLabel>Date Range</FieldLabel>
                    <select value={financialYear} onChange={e => setFinancialYear(e.target.value)} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100">
                      {financialYears.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Grouping</FieldLabel>
                    <div className="grid h-11 grid-cols-2 rounded-lg border border-slate-300 bg-slate-100 p-1">
                      {dashboardGroupModes.map(o => (
                        <button key={o} type="button" onClick={() => setDashboardGrouping(o)} className={`rounded-md text-xs font-bold transition ${dashboardGrouping === o ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>{o}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <FieldLabel>View</FieldLabel>
                    <div className="grid h-11 grid-cols-2 rounded-lg border border-slate-300 bg-slate-100 p-1">
                      {viewModes.map(o => (
                        <button key={o} type="button" onClick={() => setViewMode(o)} className={`rounded-md text-xs font-bold transition ${viewMode === o ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>{o === 'Consolidated View' ? 'Consolidated' : 'Detailed'}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sort bar for consolidated */}
              {viewMode === 'Consolidated View' && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">Sort:</span>
                  {sortFields.map(f => <SortButton key={f.key} label={f.label} sortKey={f.key} activeSort={dashboardSort} onToggle={toggleSort(setDashboardSort)} />)}
                </div>
              )}

              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                {viewMode === 'Detailed Logs' ? (
                  dashboardLogsByPeriod.length ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-3 py-2.5 sm:px-4 sm:py-3">Date</th>
                            <th className="hidden px-4 py-3 sm:table-cell">Order ID</th>
                            <th className="px-3 py-2.5 sm:px-4 sm:py-3">Buyer</th>
                            <th className="px-3 py-2.5 sm:px-4 sm:py-3">Product</th>
                            <th className="px-3 py-2.5 text-right sm:px-4 sm:py-3">Qty</th>
                            <th className="px-3 py-2.5 text-right sm:px-4 sm:py-3">Price</th>
                            <th className="hidden px-4 py-3 text-right sm:table-cell">Total</th>
                            <th className="w-8 px-2 py-2.5"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {dashboardLogsByPeriod.map(group => (
                            <React.Fragment key={group.key}>
                              <tr className="bg-blue-50 border-l-4 border-l-blue-400">
                                <td colSpan={8} className="px-3 py-2 text-sm font-bold text-blue-800 sm:px-4">{group.label}</td>
                              </tr>
                              {group.logs.map((log, i) => (
                                <tr key={`${log.orderId}-${log.productId}-${i}`} className="hover:bg-slate-50">
                                  <td className="whitespace-nowrap px-3 py-2.5 text-xs font-medium text-slate-700 sm:px-4 sm:py-3 sm:text-sm">{log.date}</td>
                                  <td className="hidden whitespace-nowrap px-4 py-3 font-semibold text-slate-900 sm:table-cell">{log.orderId}</td>
                                  <td className="px-3 py-2.5 text-xs sm:px-4 sm:py-3 sm:text-sm">{log.companyName}</td>
                                  <td className="px-3 py-2.5 text-xs sm:px-4 sm:py-3 sm:text-sm">{log.description}</td>
                                  <td className="px-3 py-2.5 text-right text-xs sm:px-4 sm:py-3 sm:text-sm">{formatNumber(log.quantity)}</td>
                                  <td className="px-3 py-2.5 text-right text-xs sm:px-4 sm:py-3 sm:text-sm">{formatCurrency(log.unitPrice)}</td>
                                  <td className="hidden px-4 py-3 text-right font-bold text-slate-950 sm:table-cell">{formatCurrency(log.totalValue)}</td>
                                  <td className="px-2 py-2.5 text-center"><NoteCell notes={log.notes} onView={setVisibleNote} /></td>
                                </tr>
                              ))}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <div className="p-5"><EmptyState title="No dashboard records found" /></div>
                ) : dashboardConsolidatedByPeriod.length ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-3 py-2.5 sm:px-4 sm:py-3">Product ID</th>
                          <th className="px-3 py-2.5 sm:px-4 sm:py-3">Product</th>
                          <th className="px-3 py-2.5 text-right sm:px-4 sm:py-3">Qty</th>
                          <th className="px-3 py-2.5 text-right sm:px-4 sm:py-3">Revenue</th>
                          <th className="hidden px-4 py-3 text-right sm:table-cell">Lines</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {dashboardConsolidatedByPeriod.map(group => (
                          <React.Fragment key={group.key}>
                            <tr className="bg-blue-50 border-l-4 border-l-blue-400">
                              <td colSpan={5} className="px-3 py-2 text-sm font-bold text-blue-800 sm:px-4">{group.label}</td>
                            </tr>
                            {group.rows.map(row => (
                              <tr key={`${row.period}-${row.productId}`} className="hover:bg-slate-50">
                                <td className="whitespace-nowrap px-3 py-2.5 font-bold text-slate-900 sm:px-4 sm:py-3">{row.productId}</td>
                                <td className="px-3 py-2.5 sm:px-4 sm:py-3">{row.description}</td>
                                <td className="px-3 py-2.5 text-right sm:px-4 sm:py-3">{formatNumber(row.totalQty)}</td>
                                <td className="px-3 py-2.5 text-right font-bold text-slate-950 sm:px-4 sm:py-3">{formatCurrency(row.totalRevenue)}</td>
                                <td className="hidden px-4 py-3 text-right sm:table-cell">{formatNumber(row.orderCount)}</td>
                              </tr>
                            ))}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <div className="p-5"><EmptyState title="No consolidated records found" /></div>}
              </div>
            </section>
          )}


          {/* BUYER ANALYTICS */}
          {activeTab === 'buyerAnalytics' && (
            <section className="space-y-5">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
                <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="relative">
                    <FieldLabel>Select Buyer</FieldLabel>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input type="text" value={analyticsBuyerSearch} onFocus={() => setDropdowns(p => ({ ...p, analyticsBuyer: true }))} onBlur={() => closeDropdownSoon('analyticsBuyer')} onChange={e => { setAnalyticsBuyerSearch(e.target.value); setSelectedAnalyticsBuyerId(''); }}
                        className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
                    </div>
                    {dropdowns.analyticsBuyer && (
                      <div className="absolute left-0 right-0 top-full z-10 mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                        {filteredAnalyticsBuyers.length ? filteredAnalyticsBuyers.map(b => (
                          <button key={b.buyerId} type="button" onMouseDown={e => e.preventDefault()} onClick={() => selectAnalyticsBuyer(b)}
                            className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5 text-left transition last:border-b-0 hover:bg-blue-50">
                            <span><span className="block text-sm font-semibold text-slate-900">{b.companyName}</span><span className="text-xs text-slate-500">{b.poc || b.contactNumber}</span></span>
                            <span className="text-xs font-bold text-blue-700">{b.buyerId}</span>
                          </button>
                        )) : <div className="px-4 py-3 text-sm text-slate-500">No buyers found</div>}
                      </div>
                    )}
                  </div>

                  {/* Product filter — searchable dropdown */}
                  <div className="relative">
                    <FieldLabel>Product Filter</FieldLabel>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input type="text" value={buyerProductSearch} placeholder="All Products" onFocus={() => setDropdowns(p => ({ ...p, buyerProduct: true }))} onBlur={() => closeDropdownSoon('buyerProduct')} onChange={e => { setBuyerProductSearch(e.target.value); if (!e.target.value) setBuyerProductFilter('ALL'); }}
                        className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
                    </div>
                    {dropdowns.buyerProduct && (
                      <div className="absolute left-0 right-0 top-full z-10 mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { setBuyerProductFilter('ALL'); setBuyerProductSearch(''); setDropdowns(p => ({ ...p, buyerProduct: false })); }}
                          className="flex w-full items-center px-4 py-2.5 text-left text-sm font-semibold text-slate-900 border-b border-slate-100 hover:bg-blue-50">All Products</button>
                        {filteredBuyerProducts.map(s => (
                          <button key={s.productId} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { setBuyerProductFilter(s.productId); setBuyerProductSearch(`${s.productId} - ${s.description}`); setDropdowns(p => ({ ...p, buyerProduct: false })); }}
                            className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5 text-left transition last:border-b-0 hover:bg-blue-50">
                            <span className="text-sm font-medium text-slate-900">{s.description}</span>
                            <span className="text-xs font-bold text-blue-700">{s.productId}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  {selectedAnalyticsBuyer ? (
                    <div>
                      <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                        <div>
                          <p className="text-xs font-semibold uppercase text-slate-500">Buyer Profile</p>
                          <h3 className="mt-1 text-lg font-bold text-slate-950">{selectedAnalyticsBuyer.companyName}</h3>
                        </div>
                        <StatusBadge tone="blue">{selectedAnalyticsBuyer.buyerId}</StatusBadge>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                        <div><p className="font-semibold text-slate-500">POC</p><p className="font-medium text-slate-900">{selectedAnalyticsBuyer.poc || '-'}</p></div>
                        <div><p className="font-semibold text-slate-500">Contact</p><p className="font-medium text-slate-900">{selectedAnalyticsBuyer.contactNumber || '-'}</p></div>
                        <div><p className="font-semibold text-slate-500">GSTIN</p><p className="font-medium text-slate-900">{selectedAnalyticsBuyer.gstin || '-'}</p></div>
                        <div><p className="font-semibold text-slate-500">E-Mail</p><p className="font-medium text-slate-900">{selectedAnalyticsBuyer.email || '-'}</p></div>
                      </div>
                    </div>
                  ) : <EmptyState title="Select a buyer to view analytics" />}
                </div>
              </div>

              {selectedAnalyticsBuyer && (
                <>
                  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <FieldLabel>Date Range</FieldLabel>
                        <select value={buyerDateRange} onChange={e => setBuyerDateRange(e.target.value)} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100">
                          {buyerDateRangeOptions.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <FieldLabel>Grouping</FieldLabel>
                        <div className="grid h-11 grid-cols-2 rounded-lg border border-slate-300 bg-slate-100 p-1">
                          {buyerGroupModes.map(o => (
                            <button key={o} type="button" onClick={() => setBuyerGrouping(o)} className={`rounded-md text-xs font-bold transition ${buyerGrouping === o ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>{o}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <FieldLabel>View</FieldLabel>
                        <div className="grid h-11 grid-cols-2 rounded-lg border border-slate-300 bg-slate-100 p-1">
                          {buyerViewModes.map(o => (
                            <button key={o} type="button" onClick={() => setBuyerViewMode(o)} className={`rounded-md text-xs font-bold transition ${buyerViewMode === o ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>{o}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                    <StatTile label="Revenue" value={formatCurrency(buyerAnalyticsStats.revenue)} icon={BarChart3} tone="blue" />
                    <StatTile label="Quantity" value={formatNumber(buyerAnalyticsStats.quantity)} icon={Package} tone="emerald" />
                    <StatTile label="Products" value={formatNumber(buyerAnalyticsStats.productCount)} icon={Package} tone="amber" />
                    <StatTile label="Lines" value={formatNumber(buyerAnalyticsStats.orderCount)} icon={History} tone="slate" />
                  </div>

                  {/* Sort bar for consolidated */}
                  {buyerViewMode === 'Consolidated' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500">Sort:</span>
                      {sortFields.map(f => <SortButton key={f.key} label={f.label} sortKey={f.key} activeSort={buyerSort} onToggle={toggleSort(setBuyerSort)} />)}
                    </div>
                  )}

                  <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                    {buyerViewMode === 'Detailed Logs' ? (
                      buyerLogsByPeriod.length ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-slate-200 text-sm">
                            <thead className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                              <tr>
                                <th className="px-3 py-2.5 sm:px-4 sm:py-3">Date</th>
                                <th className="hidden px-4 py-3 sm:table-cell">Order ID</th>
                                <th className="px-3 py-2.5 sm:px-4 sm:py-3">Product</th>
                                <th className="px-3 py-2.5 text-right sm:px-4 sm:py-3">Qty</th>
                                <th className="px-3 py-2.5 text-right sm:px-4 sm:py-3">Price</th>
                                <th className="hidden px-4 py-3 text-right sm:table-cell">Total</th>
                                <th className="w-8 px-2 py-2.5"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {buyerLogsByPeriod.map(group => (
                                <React.Fragment key={group.key}>
                                  <tr className="bg-blue-50 border-l-4 border-l-blue-400">
                                    <td colSpan={7} className="px-3 py-2 text-sm font-bold text-blue-800 sm:px-4">{group.label}</td>
                                  </tr>
                                  {group.logs.map((log, i) => (
                                    <tr key={`${log.orderId}-${log.productId}-${i}`} className="hover:bg-slate-50">
                                      <td className="whitespace-nowrap px-3 py-2.5 text-xs font-medium text-slate-700 sm:px-4 sm:py-3 sm:text-sm">{log.date}</td>
                                      <td className="hidden whitespace-nowrap px-4 py-3 font-semibold text-slate-900 sm:table-cell">{log.orderId}</td>
                                      <td className="px-3 py-2.5 text-xs sm:px-4 sm:py-3 sm:text-sm">{log.description}</td>
                                      <td className="px-3 py-2.5 text-right text-xs sm:px-4 sm:py-3 sm:text-sm">{formatNumber(log.quantity)}</td>
                                      <td className="px-3 py-2.5 text-right text-xs sm:px-4 sm:py-3 sm:text-sm">{formatCurrency(log.unitPrice)}</td>
                                      <td className="hidden px-4 py-3 text-right font-bold text-slate-950 sm:table-cell">{formatCurrency(log.totalValue)}</td>
                                      <td className="px-2 py-2.5 text-center"><NoteCell notes={log.notes} onView={setVisibleNote} /></td>
                                    </tr>
                                  ))}
                                </React.Fragment>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : <div className="p-5"><EmptyState title="No buyer transactions match the selected filters" /></div>
                    ) : buyerConsolidatedByPeriod.length ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                          <thead className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                            <tr>
                              <th className="px-3 py-2.5 sm:px-4 sm:py-3">Product ID</th>
                              <th className="px-3 py-2.5 sm:px-4 sm:py-3">Product</th>
                              <th className="px-3 py-2.5 text-right sm:px-4 sm:py-3">Qty</th>
                              <th className="px-3 py-2.5 text-right sm:px-4 sm:py-3">Revenue</th>
                              <th className="hidden px-4 py-3 text-right sm:table-cell">Lines</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {buyerConsolidatedByPeriod.map(group => (
                              <React.Fragment key={group.key}>
                                <tr className="bg-blue-50 border-l-4 border-l-blue-400">
                                  <td colSpan={5} className="px-3 py-2 text-sm font-bold text-blue-800 sm:px-4">{group.label}</td>
                                </tr>
                                {group.rows.map(row => (
                                  <tr key={`${row.period}-${row.productId}`} className="hover:bg-slate-50">
                                    <td className="whitespace-nowrap px-3 py-2.5 font-bold text-slate-900 sm:px-4 sm:py-3">{row.productId}</td>
                                    <td className="px-3 py-2.5 sm:px-4 sm:py-3">{row.description}</td>
                                    <td className="px-3 py-2.5 text-right sm:px-4 sm:py-3">{formatNumber(row.totalQty)}</td>
                                    <td className="px-3 py-2.5 text-right font-bold text-slate-950 sm:px-4 sm:py-3">{formatCurrency(row.totalRevenue)}</td>
                                    <td className="hidden px-4 py-3 text-right sm:table-cell">{formatNumber(row.orderCount)}</td>
                                  </tr>
                                ))}
                              </React.Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : <div className="p-5"><EmptyState title="No consolidated buyer records found" /></div>}
                  </div>
                </>
              )}
            </section>
          )}


          {/* STORAGE LOGS */}
          {activeTab === 'logs' && (
            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              {allSortedLogs.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2.5 sm:px-4 sm:py-3">Date</th>
                        <th className="hidden px-4 py-3 sm:table-cell">Order ID</th>
                        <th className="px-3 py-2.5 sm:px-4 sm:py-3">Buyer</th>
                        <th className="px-3 py-2.5 sm:px-4 sm:py-3">Product</th>
                        <th className="px-3 py-2.5 text-right sm:px-4 sm:py-3">Qty</th>
                        <th className="px-3 py-2.5 text-right sm:px-4 sm:py-3">Price</th>
                        <th className="w-8 px-2 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {allSortedLogs.map((log, i) => (
                        <tr key={`${log.orderId}-${log.productId}-${i}`} className="hover:bg-slate-50">
                          <td className="whitespace-nowrap px-3 py-2.5 text-xs font-medium text-slate-700 sm:px-4 sm:py-3 sm:text-sm">{log.date}</td>
                          <td className="hidden whitespace-nowrap px-4 py-3 font-semibold text-slate-900 sm:table-cell">{log.orderId}</td>
                          <td className="px-3 py-2.5 text-xs sm:px-4 sm:py-3 sm:text-sm">{log.companyName}</td>
                          <td className="px-3 py-2.5 text-xs sm:px-4 sm:py-3 sm:text-sm">{log.description}</td>
                          <td className="px-3 py-2.5 text-right text-xs sm:px-4 sm:py-3 sm:text-sm">{formatNumber(log.quantity)}</td>
                          <td className="px-3 py-2.5 text-right text-xs sm:px-4 sm:py-3 sm:text-sm">{formatCurrency(log.unitPrice)}</td>
                          <td className="px-2 py-2.5 text-center"><NoteCell notes={log.notes} onView={setVisibleNote} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <div className="p-5"><EmptyState title="No storage logs found" /></div>}
            </section>
          )}

          {/* SKU MASTER */}
          {activeTab === 'skus' && (
            <section className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <FieldLabel>Search SKUs</FieldLabel>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input type="text" value={skuSearch} onChange={e => setSkuSearch(e.target.value)} className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                {filteredSkuMasterRows.length ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-3 py-2.5 sm:px-4 sm:py-3">Product ID</th>
                          <th className="px-3 py-2.5 sm:px-4 sm:py-3">Description</th>
                          <th className="px-3 py-2.5 sm:px-4 sm:py-3">Last Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredSkuMasterRows.map(sku => (
                          <tr key={sku.productId} className="hover:bg-slate-50">
                            <td className="whitespace-nowrap px-3 py-2.5 font-bold text-slate-900 sm:px-4 sm:py-3">{sku.productId}</td>
                            <td className="px-3 py-2.5 sm:px-4 sm:py-3">{sku.description}</td>
                            <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                              {editingSkuId === sku.productId ? (
                                <div className="flex items-center gap-1.5">
                                  <input ref={skuInputRef} type="number" min="0" step="0.01" value={editingSkuPrice} onChange={e => setEditingSkuPrice(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleSkuPriceSave(sku.productId); if (e.key === 'Escape') setEditingSkuId(null); }}
                                    className="h-8 w-28 rounded border border-blue-400 bg-white px-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-blue-200" />
                                  <button type="button" onClick={() => handleSkuPriceSave(sku.productId)} disabled={Boolean(updatingSkuId)} className="rounded-md p-1 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50">
                                    {updatingSkuId === sku.productId ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
                                  </button>
                                  <button type="button" onClick={() => setEditingSkuId(null)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100"><X size={14} /></button>
                                </div>
                              ) : (
                                <button type="button" onClick={() => startEditSku(sku)} className="rounded px-2 py-1 text-sm font-semibold text-slate-900 hover:bg-blue-50 hover:text-blue-700 transition">
                                  {sku.defaultPrice ? formatCurrency(sku.defaultPrice) : '—'}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <div className="p-5"><EmptyState title="No SKU records found" /></div>}
              </div>
            </section>
          )}

          {/* BUYER MASTER */}
          {activeTab === 'buyers' && (
            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              {buyers.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2.5 sm:px-4 sm:py-3">Buyer ID</th>
                        <th className="px-3 py-2.5 sm:px-4 sm:py-3">Company</th>
                        <th className="hidden px-4 py-3 sm:table-cell">POC</th>
                        <th className="px-3 py-2.5 sm:px-4 sm:py-3">Contact</th>
                        <th className="hidden px-4 py-3 md:table-cell">E-Mail</th>
                        <th className="hidden px-4 py-3 md:table-cell">GSTIN</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {buyers.map(b => (
                        <tr key={b.buyerId} className="hover:bg-slate-50">
                          <td className="whitespace-nowrap px-3 py-2.5 font-bold text-slate-900 sm:px-4 sm:py-3">{b.buyerId}</td>
                          <td className="px-3 py-2.5 font-semibold text-slate-900 sm:px-4 sm:py-3">{b.companyName}</td>
                          <td className="hidden px-4 py-3 sm:table-cell">{b.poc}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">{b.contactNumber}</td>
                          <td className="hidden whitespace-nowrap px-4 py-3 md:table-cell">{b.email}</td>
                          <td className="hidden whitespace-nowrap px-4 py-3 md:table-cell">{b.gstin}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <div className="p-5"><EmptyState title="No buyer records found" /></div>}
            </section>
          )}
        </div>
      </main>

      {visibleNote && <NotePopup note={visibleNote} onClose={() => setVisibleNote(null)} />}
    </div>
  );
}
