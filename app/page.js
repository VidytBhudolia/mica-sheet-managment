'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  Building2,
  Check,
  CheckCircle2,
  History,
  LayoutDashboard,
  Loader2,
  LogOut,
  Package,
  PlusCircle,
  RefreshCw,
  Save,
  Search,
  Shield,
  StickyNote,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { appendOrderLog, fetchMasterData, getUsersList, registerNewUser, updateSkuPrice, updateUserStatus } from './actions';

const allNavItems = [
  { id: 'entry', label: 'Data Entry', icon: PlusCircle, access: 'all' },
  { id: 'macroTrends', label: 'Macro Trends', icon: TrendingUp, access: 'admin' },
  { id: 'buyerAnalytics', label: 'Buyer Analytics', icon: BarChart3, access: 'admin' },
  { id: 'skuAnalytics', label: 'SKU Analytics', icon: Package, access: 'admin' },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, access: 'admin' },
  { id: 'logs', label: 'Storage Logs', icon: History, access: 'all' },
  { id: 'skus', label: 'SKU Master', icon: Package, access: 'admin' },
  { id: 'buyers', label: 'Buyer Master', icon: Users, access: 'admin' },
  { id: 'admin', label: 'Admin Panel', icon: Shield, access: 'admin' },
];

const financialYears = ['ALL', '2026-2027', '2025-2026', '2024-2025'];
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
});

const createLineItem = () => ({
  id: Math.random().toString(36).slice(2, 9),
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

function SortableHeader({ label, sortKey, activeSort, onSort, className = '' }) {
  const isActive = activeSort.key === sortKey;
  return (
    <th className={`px-3 py-2.5 sm:px-4 sm:py-3 cursor-pointer select-none hover:bg-slate-200 transition ${className}`} onClick={() => onSort(sortKey)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive ? (activeSort.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} className="opacity-40" />}
      </span>
    </th>
  );
}

export default function MicaSheetManagment() {
  const { data: session, status: sessionStatus } = useSession();
  const userRole = session?.user?.role || 'Employee';
  const userStatus = session?.user?.status || 'New';
  const isAdmin = userRole === 'Admin' && userStatus === 'Active';
  const isActive = userStatus === 'Active';
  const isRegistered = session?.user?.isRegistered || false;

  // Registration form state
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regSubmitting, setRegSubmitting] = useState(false);

  const navItems = useMemo(() => {
    if (isAdmin) return allNavItems;
    return allNavItems.filter(item => item.access === 'all');
  }, [isAdmin]);

  const [activeTab, setActiveTab] = useState('entry');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState(createInitialForm);
  const [orderLines, setOrderLines] = useState(() => [createLineItem()]);
  const [dropdowns, setDropdowns] = useState({ buyer: false, analyticsBuyer: false, buyerProduct: false, skuAnalyticsSku: false });
  const [activeProductDropdown, setActiveProductDropdown] = useState(null);
  const [financialYear, setFinancialYear] = useState('ALL');
  const [viewMode, setViewMode] = useState('Detailed Logs');
  const [dashboardGrouping, setDashboardGrouping] = useState('Annually');
  const [dashboardSort, setDashboardSort] = useState({ key: 'totalRevenue', dir: 'desc' });
  // Buyer Analytics state
  const [analyticsBuyerSearch, setAnalyticsBuyerSearch] = useState('');
  const [selectedAnalyticsBuyerId, setSelectedAnalyticsBuyerId] = useState('');
  const [buyerProductFilter, setBuyerProductFilter] = useState('ALL');
  const [buyerProductSearch, setBuyerProductSearch] = useState('');
  const [buyerDateRange, setBuyerDateRange] = useState('All Time');
  const [buyerGrouping, setBuyerGrouping] = useState('Year-wise');
  const [buyerViewMode, setBuyerViewMode] = useState('Detailed Logs');
  const [buyerSort, setBuyerSort] = useState({ key: 'totalRevenue', dir: 'desc' });
  // YoY Variance state
  const [yoyBaselineYear, setYoyBaselineYear] = useState('');
  const [yoyComparisonYear, setYoyComparisonYear] = useState('');

  // SKU Analytics state
  const [selectedAnalyticsSkuId, setSelectedAnalyticsSkuId] = useState('');
  const [skuAnalyticsSearch, setSkuAnalyticsSearch] = useState('');
  const [skuAnalyticsGrouping, setSkuAnalyticsGrouping] = useState('Year-wise');

  // Macro Trends state
  const [macroPerspective, setMacroPerspective] = useState('buyer');
  const [macroYearFilter, setMacroYearFilter] = useState('ALL');
  const [macroSort, setMacroSort] = useState({ key: 'ltv', dir: 'desc' });

  // Admin Panel state
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminUpdating, setAdminUpdating] = useState(null);

  // Shared state
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

  // Navigation helper — routes to analytics tabs from Macro Trends
  const navigateToAnalytics = (type, id) => {
    if (type === 'buyer') {
      setSelectedAnalyticsBuyerId(id);
      const buyer = buyers.find(b => b.buyerId === id);
      setAnalyticsBuyerSearch(buyer?.companyName || id);
      setActiveTab('buyerAnalytics');
    } else if (type === 'sku') {
      setSelectedAnalyticsSkuId(id);
      const sku = skus.find(s => s.productId === id);
      setSkuAnalyticsSearch(sku?.description || id);
      setActiveTab('skuAnalytics');
    }
  };

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

  // Load admin users when admin tab is selected
  useEffect(() => {
    if (activeTab === 'admin' && isAdmin) {
      setAdminLoading(true);
      getUsersList().then(result => {
        if (result.success) setAdminUsers(result.users);
        setAdminLoading(false);
      }).catch(() => setAdminLoading(false));
    }
  }, [activeTab, isAdmin]);

  const handleUserStatusChange = async (rowIndex, newStatus) => {
    setAdminUpdating(rowIndex);
    // Optimistic update
    setAdminUsers(prev => prev.map(u => u.rowIndex === rowIndex ? { ...u, status: newStatus } : u));
    const result = await updateUserStatus(rowIndex, newStatus);
    if (!result.success) {
      // Rollback
      const freshData = await getUsersList();
      if (freshData.success) setAdminUsers(freshData.users);
      setStatus({ type: 'error', message: result.error || 'Failed to update user.' });
    }
    setAdminUpdating(null);
  };

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

  const getFilteredSkusForLine = (searchQuery) => {
    const q = normalize(searchQuery);
    return skus.filter(s => !q || `${s.productId} ${s.description}`.toLowerCase().includes(q));
  };

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

  const filteredSkuAnalyticsSkus = useMemo(() => {
    const q = normalize(skuAnalyticsSearch);
    return skus.filter(s => !q || `${s.productId} ${s.description}`.toLowerCase().includes(q));
  }, [skus, skuAnalyticsSearch]);

  const enrichedLogs = useMemo(() => storageLogs.map(log => {
    const buyer = buyerMap.get(log.buyerId);
    const sku = skuMap.get(log.productId);
    const quantity = Number(log.quantity) || 0;
    const unitPrice = Number(log.unitPrice) || 0;
    return { ...log, companyName: buyer?.companyName || 'Unknown Buyer', description: sku?.description || 'Unknown Product', quantity, unitPrice, totalValue: quantity * unitPrice, fy: getFinancialYear(log.date), monthKey: getMonthKey(log.date) };
  }), [buyerMap, skuMap, storageLogs]);

  // --- MACRO TRENDS: Buyer Perspective ---
  const macroFilteredLogs = useMemo(() => {
    if (macroYearFilter === 'ALL') return enrichedLogs;
    return enrichedLogs.filter(l => l.fy === macroYearFilter);
  }, [enrichedLogs, macroYearFilter]);

  const macroBuyerData = useMemo(() => {
    const grouped = new Map();
    macroFilteredLogs.forEach(log => {
      const cur = grouped.get(log.buyerId) || { buyerId: log.buyerId, companyName: log.companyName, ltv: 0, orderIds: new Set(), lastOrderDate: '' };
      cur.ltv += log.totalValue;
      if (log.orderId) cur.orderIds.add(log.orderId);
      const logSort = getDateSortValue(log.date);
      const curSort = getDateSortValue(cur.lastOrderDate);
      if (logSort > curSort) cur.lastOrderDate = log.date;
      grouped.set(log.buyerId, cur);
    });
    return [...grouped.values()].map(b => ({
      ...b,
      totalOrders: b.orderIds.size,
      aov: b.orderIds.size > 0 ? b.ltv / b.orderIds.size : 0,
    }));
  }, [macroFilteredLogs]);

  // --- MACRO TRENDS: SKU Perspective ---
  const macroSkuData = useMemo(() => {
    const grouped = new Map();
    macroFilteredLogs.forEach(log => {
      const cur = grouped.get(log.productId) || { productId: log.productId, description: log.description, ltv: 0, orderIds: new Set(), totalQty: 0, lastOrderDate: '' };
      cur.ltv += log.totalValue;
      cur.totalQty += log.quantity;
      if (log.orderId) cur.orderIds.add(log.orderId);
      const logSort = getDateSortValue(log.date);
      const curSort = getDateSortValue(cur.lastOrderDate);
      if (logSort > curSort) cur.lastOrderDate = log.date;
      grouped.set(log.productId, cur);
    });
    return [...grouped.values()].map(s => ({
      ...s,
      totalOrders: s.orderIds.size,
    }));
  }, [macroFilteredLogs]);

  // --- DASHBOARD ---
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
  const selectedAnalyticsSku = skuMap.get(selectedAnalyticsSkuId);

  // --- BUYER ANALYTICS ---
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
    const uniqueOrders = new Set(buyerAnalyticsLogs.map(l => l.orderId).filter(Boolean)).size;
    return { revenue, quantity, productCount, orderCount: uniqueOrders };
  }, [buyerAnalyticsLogs]);

  // YoY Variance Engine for Buyer Analytics
  const yoyVarianceData = useMemo(() => {
    if (!selectedAnalyticsBuyerId || !yoyBaselineYear || !yoyComparisonYear) return [];
    const buyerLogs = enrichedLogs.filter(l => l.buyerId === selectedAnalyticsBuyerId);
    const baselineLogs = buyerLogs.filter(l => l.fy === yoyBaselineYear);
    const comparisonLogs = buyerLogs.filter(l => l.fy === yoyComparisonYear);
    const skuQty = new Map();
    baselineLogs.forEach(l => {
      const cur = skuQty.get(l.productId) || { productId: l.productId, description: l.description, baselineQty: 0, comparisonQty: 0 };
      cur.baselineQty += l.quantity;
      skuQty.set(l.productId, cur);
    });
    comparisonLogs.forEach(l => {
      const cur = skuQty.get(l.productId) || { productId: l.productId, description: l.description, baselineQty: 0, comparisonQty: 0 };
      cur.comparisonQty += l.quantity;
      skuQty.set(l.productId, cur);
    });
    return [...skuQty.values()].map(row => ({ ...row, variance: row.comparisonQty - row.baselineQty }));
  }, [enrichedLogs, selectedAnalyticsBuyerId, yoyBaselineYear, yoyComparisonYear]);

  const dashboardStats = useMemo(() => {
    const revenue = dashboardLogs.reduce((s, l) => s + l.totalValue, 0);
    const quantity = dashboardLogs.reduce((s, l) => s + l.quantity, 0);
    const buyerCount = new Set(dashboardLogs.map(l => l.buyerId).filter(Boolean)).size;
    const uniqueOrders = new Set(dashboardLogs.map(l => l.orderId).filter(Boolean)).size;
    return { revenue, quantity, buyerCount, orderCount: uniqueOrders };
  }, [dashboardLogs]);

  // --- SKU ANALYTICS ---
  const skuAnalyticsLogs = useMemo(() => {
    if (!selectedAnalyticsSkuId) return [];
    return enrichedLogs.filter(l => l.productId === selectedAnalyticsSkuId).sort((a, b) => getDateSortValue(b.date) - getDateSortValue(a.date));
  }, [enrichedLogs, selectedAnalyticsSkuId]);

  // Top Buyers for selected SKU
  const skuTopBuyers = useMemo(() => {
    const grouped = new Map();
    skuAnalyticsLogs.forEach(log => {
      const cur = grouped.get(log.buyerId) || { buyerId: log.buyerId, companyName: log.companyName, totalQty: 0, totalRevenue: 0, lastPurchaseDate: '' };
      cur.totalQty += log.quantity;
      cur.totalRevenue += log.totalValue;
      const logSort = getDateSortValue(log.date);
      const curSort = getDateSortValue(cur.lastPurchaseDate);
      if (logSort > curSort) cur.lastPurchaseDate = log.date;
      grouped.set(log.buyerId, cur);
    });
    return [...grouped.values()].sort((a, b) => b.totalQty - a.totalQty);
  }, [skuAnalyticsLogs]);

  // Trend Engine for SKU (Year-wise or Month-wise)
  const skuTrendData = useMemo(() => {
    const isMW = skuAnalyticsGrouping === 'Month-wise';
    const grouped = new Map();
    skuAnalyticsLogs.forEach(log => {
      const period = isMW ? log.monthKey : log.fy;
      const periodSort = isMW ? getMonthSortValue(log.date) : getFinancialYearSortValue(log.fy);
      const cur = grouped.get(period) || { period, periodSort, label: isMW ? getMonthLabel(period) : period, totalQty: 0, totalRevenue: 0 };
      cur.totalQty += log.quantity;
      cur.totalRevenue += log.totalValue;
      grouped.set(period, cur);
    });
    return [...grouped.values()].sort((a, b) => b.periodSort - a.periodSort);
  }, [skuAnalyticsLogs, skuAnalyticsGrouping]);

  const canSubmit = Boolean(form.date && form.orderId && form.buyerId && orderLines.every(l => l.productId && l.quantity && l.unitPrice) && !isSubmitting);
  const updateForm = changes => setForm(prev => ({ ...prev, ...changes }));
  const closeDropdownSoon = key => { window.setTimeout(() => setDropdowns(prev => ({ ...prev, [key]: false })), 150); };

  const updateLineItem = (lineId, changes) => {
    setOrderLines(prev => prev.map(l => l.id === lineId ? { ...l, ...changes } : l));
  };
  const addLineItem = () => setOrderLines(prev => [...prev, createLineItem()]);
  const removeLineItem = (lineId) => setOrderLines(prev => prev.length > 1 ? prev.filter(l => l.id !== lineId) : prev);
  const closeProductDropdownSoon = () => { window.setTimeout(() => setActiveProductDropdown(null), 150); };

  const toggleSort = (setter) => (key) => {
    setter(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' });
  };

  const toggleMacroSort = (key) => {
    setMacroSort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' });
  };

  const handleSubmit = async event => {
    event.preventDefault();
    if (!canSubmit) { setStatus({ type: 'error', message: 'Complete all required fields before submitting.' }); return; }
    setIsSubmitting(true);
    setStatus(null);

    const linesToSubmit = orderLines.map(line => ({
      date: form.date,
      buyerId: form.buyerId,
      productId: line.productId,
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice),
      orderId: form.orderId,
      notes: line.notes,
    }));

    // Optimistic UI — add all lines
    setStorageLogs(prev => [...linesToSubmit, ...prev]);

    let allSuccess = true;
    for (const newLog of linesToSubmit) {
      const result = await appendOrderLog(newLog);
      if (!result.success) {
        setStorageLogs(prev => prev.filter(l => !linesToSubmit.includes(l)));
        setStatus({ type: 'error', message: result.error || 'Order could not be submitted.' });
        setIsSubmitting(false);
        allSuccess = false;
        break;
      }
      if (newLog.unitPrice > 0) setSkus(prev => prev.map(s => s.productId === newLog.productId ? { ...s, defaultPrice: newLog.unitPrice } : s));
    }

    if (allSuccess) {
      setOrderLines([createLineItem()]);
      setStatus({ type: 'success', message: `${linesToSubmit.length} line${linesToSubmit.length > 1 ? 's' : ''} added to Storage.` });
    }
    setIsSubmitting(false);
  };

  const selectAnalyticsBuyer = buyer => {
    setSelectedAnalyticsBuyerId(buyer.buyerId);
    setAnalyticsBuyerSearch(buyer.companyName);
    setDropdowns(prev => ({ ...prev, analyticsBuyer: false }));
  };

  const selectAnalyticsSku = sku => {
    setSelectedAnalyticsSkuId(sku.productId);
    setSkuAnalyticsSearch(sku.description);
    setDropdowns(prev => ({ ...prev, skuAnalyticsSku: false }));
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

  // Sorted macro data
  const sortedMacroBuyers = useMemo(() => {
    const data = [...macroBuyerData];
    const { key, dir } = macroSort;
    data.sort((a, b) => {
      let av, bv;
      if (key === 'companyName') { av = a.companyName; bv = b.companyName; return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av); }
      if (key === 'lastOrderDate') { av = getDateSortValue(a.lastOrderDate); bv = getDateSortValue(b.lastOrderDate); }
      else if (key === 'ltv') { av = a.ltv; bv = b.ltv; }
      else if (key === 'totalOrders') { av = a.totalOrders; bv = b.totalOrders; }
      else if (key === 'aov') { av = a.aov; bv = b.aov; }
      else { av = 0; bv = 0; }
      return dir === 'asc' ? av - bv : bv - av;
    });
    return data;
  }, [macroBuyerData, macroSort]);

  const sortedMacroSkus = useMemo(() => {
    const data = [...macroSkuData];
    const { key, dir } = macroSort;
    data.sort((a, b) => {
      let av, bv;
      if (key === 'description') { av = a.description; bv = b.description; return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av); }
      if (key === 'lastOrderDate') { av = getDateSortValue(a.lastOrderDate); bv = getDateSortValue(b.lastOrderDate); }
      else if (key === 'ltv') { av = a.ltv; bv = b.ltv; }
      else if (key === 'totalOrders') { av = a.totalOrders; bv = b.totalOrders; }
      else if (key === 'totalQty') { av = a.totalQty; bv = b.totalQty; }
      else { av = 0; bv = 0; }
      return dir === 'asc' ? av - bv : bv - av;
    });
    return data;
  }, [macroSkuData, macroSort]);


  // --- AUTH SCREENS ---

  // Session loading
  if (sessionStatus === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-700">
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm font-semibold shadow-sm">
          <Loader2 className="animate-spin text-blue-600" size={20} />
          Loading session...
        </div>
      </div>
    );
  }

  // Unauthenticated — Login Screen
  if (sessionStatus === 'unauthenticated' || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-lg text-center">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-xl bg-blue-600">
            <Building2 size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Nexus B2B</h1>
          <p className="mt-2 text-sm text-slate-500">Sales and Inventory Management</p>
          <button
            type="button"
            onClick={() => signIn('google')}
            className="mt-8 inline-flex h-12 w-full items-center justify-center gap-3 rounded-lg bg-slate-900 px-6 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800"
          >
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  // New user — Registration form (collect Name and Phone)
  if (!isRegistered || userStatus === 'New') {
    const handleRegister = async (e) => {
      e.preventDefault();
      if (!regName.trim() || !regPhone.trim()) return;
      setRegSubmitting(true);
      const result = await registerNewUser(session.user.email, regName, regPhone);
      if (result.success) {
        // Force session refresh to pick up new status
        window.location.reload();
      } else {
        setStatus({ type: 'error', message: result.error || 'Registration failed.' });
        setRegSubmitting(false);
      }
    };

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-lg">
          <div className="text-center">
            <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-xl bg-blue-600">
              <Building2 size={28} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Complete Your Profile</h1>
            <p className="mt-2 text-sm text-slate-500">Please provide your details to request access</p>
            <p className="mt-1 text-xs text-slate-400">{session.user.email}</p>
          </div>
          <form onSubmit={handleRegister} className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Full Name</label>
              <input type="text" value={regName} onChange={e => setRegName(e.target.value)} placeholder="e.g. Rajesh Kumar" required
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Phone Number</label>
              <input type="tel" value={regPhone} onChange={e => setRegPhone(e.target.value)} placeholder="e.g. 9876543210" required
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
            </div>
            {status && status.type === 'error' && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                <AlertCircle size={14} />{status.message}
              </div>
            )}
            <button type="submit" disabled={regSubmitting || !regName.trim() || !regPhone.trim()}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">
              {regSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
              Request Access
            </button>
          </form>
          <div className="mt-4 text-center">
            <button type="button" onClick={() => signOut()} className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 transition hover:text-slate-700">
              <LogOut size={12} />Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Pending Approval
  if (userStatus === 'Pending') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-lg text-center">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-xl bg-amber-100">
            <Loader2 size={28} className="text-amber-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Approval Pending</h1>
          <p className="mt-3 text-sm text-slate-500">Your account is awaiting administrator approval. Please contact your admin to unlock access.</p>
          <p className="mt-4 text-xs text-slate-400">Signed in as {session.user.email}</p>
          <button type="button" onClick={() => signOut()} className="mt-6 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
            <LogOut size={14} />Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Terminated
  if (userStatus === 'Terminated') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-lg text-center">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-xl bg-red-100">
            <X size={28} className="text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Access Revoked</h1>
          <p className="mt-3 text-sm text-slate-500">Your access to this system has been terminated. Contact your administrator if you believe this is an error.</p>
          <p className="mt-4 text-xs text-slate-400">Signed in as {session.user.email}</p>
          <button type="button" onClick={() => signOut()} className="mt-6 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
            <LogOut size={14} />Sign Out
          </button>
        </div>
      </div>
    );
  }

  // --- END AUTH SCREENS ---

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
              <h1 className="ml-3 text-lg font-bold">Mica Sheet Managment</h1>
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
            <h1 className="text-lg font-bold tracking-wide">Mica Sheet Managment</h1>
            <p className="text-xs font-medium text-slate-400">Sales and Inventory</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
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
        <div className="border-t border-slate-800 p-5 space-y-3">
          <div className="rounded-lg bg-slate-800 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Records</p>
            <p className="mt-2 text-2xl font-bold">{formatNumber(storageLogs.length)}</p>
          </div>
          <div className="rounded-lg bg-slate-800 p-3">
            <p className="truncate text-xs font-medium text-slate-400">{session?.user?.email}</p>
            <button type="button" onClick={() => signOut()} className="mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-600 hover:text-white">
              <LogOut size={13} />Sign Out
            </button>
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

                {/* Line Items */}
                <div className="space-y-4">
                  {orderLines.map((line, idx) => {
                    const lineSkus = getFilteredSkusForLine(line.productSearch);
                    const lineTotal = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
                    return (
                      <div key={line.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Item {idx + 1}</span>
                          {orderLines.length > 1 && (
                            <button type="button" onClick={() => removeLineItem(line.id)} className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"><X size={16} /></button>
                          )}
                        </div>
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(140px,0.5fr)]">
                          <div className="relative">
                            <FieldLabel>Product Search</FieldLabel>
                            <div className="relative">
                              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                              <input type="text" value={line.productSearch} onFocus={() => setActiveProductDropdown(line.id)} onBlur={closeProductDropdownSoon} onChange={e => updateLineItem(line.id, { productSearch: e.target.value, productId: '', unitPrice: '' })} className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
                            </div>
                            {activeProductDropdown === line.id && (
                              <div className="absolute left-0 right-0 top-full z-10 mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                                {lineSkus.length ? lineSkus.map(s => (
                                  <button key={s.productId} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { updateLineItem(line.id, { productId: s.productId, productSearch: s.description, unitPrice: String(lastPriceMap.get(s.productId) || s.defaultPrice || '') }); setActiveProductDropdown(null); }}
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
                            <input type="text" value={line.productId} disabled className="h-11 w-full rounded-lg border border-slate-200 bg-slate-100 px-4 text-sm font-bold text-slate-700" />
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div>
                            <FieldLabel>Quantity</FieldLabel>
                            <input type="number" min="0" step="0.01" value={line.quantity} onChange={e => updateLineItem(line.id, { quantity: e.target.value })} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
                          </div>
                          <div>
                            <FieldLabel>Unit Price</FieldLabel>
                            <input type="number" min="0" step="0.01" value={line.unitPrice} onChange={e => updateLineItem(line.id, { unitPrice: e.target.value })} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
                          </div>
                          <div>
                            <FieldLabel>Notes</FieldLabel>
                            <input type="text" value={line.notes} onChange={e => updateLineItem(line.id, { notes: e.target.value })} placeholder="Optional" className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
                          </div>
                        </div>
                        <div className="text-right text-sm font-semibold text-slate-600">Line Total: <span className="text-slate-950">{formatCurrency(lineTotal)}</span></div>
                      </div>
                    );
                  })}

                  {/* Add Line Button */}
                  <button type="button" onClick={addLineItem} className="inline-flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700">
                    <PlusCircle size={16} />Add Product Line
                  </button>
                </div>

                <div className="flex flex-col justify-between gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center">
                  <div className="text-sm font-bold text-slate-900">Order Total: <span className="text-lg text-slate-950">{formatCurrency(orderLines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0))}</span></div>
                  <button type="submit" disabled={!canSubmit} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                    {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}Submit {orderLines.length > 1 ? `(${orderLines.length} lines)` : ''}
                  </button>
                </div>
              </form>
            </section>
          )}


          {/* MACRO TRENDS */}
          {activeTab === 'macroTrends' && (
            <section className="space-y-5">
              {/* Toggle + Year Filter */}
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <div className="grid h-11 max-w-md grid-cols-2 rounded-lg border border-slate-300 bg-slate-100 p-1">
                      <button type="button" onClick={() => { setMacroPerspective('buyer'); setMacroSort({ key: 'ltv', dir: 'desc' }); }} className={`rounded-md text-xs font-bold transition ${macroPerspective === 'buyer' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>Buyer Perspective</button>
                      <button type="button" onClick={() => { setMacroPerspective('sku'); setMacroSort({ key: 'ltv', dir: 'desc' }); }} className={`rounded-md text-xs font-bold transition ${macroPerspective === 'sku' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>SKU Perspective</button>
                    </div>
                  </div>
                  <div className="w-full sm:w-48">
                    <FieldLabel>Year Range</FieldLabel>
                    <select value={macroYearFilter} onChange={e => setMacroYearFilter(e.target.value)} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100">
                      {financialYears.map(o => <option key={o} value={o}>{o === 'ALL' ? 'All Years' : o}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Buyer Perspective Table */}
              {macroPerspective === 'buyer' && (
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                  {sortedMacroBuyers.length ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                          <tr>
                            <SortableHeader label="Company Name" sortKey="companyName" activeSort={macroSort} onSort={toggleMacroSort} />
                            <SortableHeader label="Last Order" sortKey="lastOrderDate" activeSort={macroSort} onSort={toggleMacroSort} />
                            <SortableHeader label="LTV" sortKey="ltv" activeSort={macroSort} onSort={toggleMacroSort} className="text-right" />
                            <SortableHeader label="Orders" sortKey="totalOrders" activeSort={macroSort} onSort={toggleMacroSort} className="text-right" />
                            <SortableHeader label="AOV" sortKey="aov" activeSort={macroSort} onSort={toggleMacroSort} className="text-right hidden sm:table-cell" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {sortedMacroBuyers.map(row => (
                            <tr key={row.buyerId} onClick={() => navigateToAnalytics('buyer', row.buyerId)} className="cursor-pointer hover:bg-slate-100 transition">
                              <td className="px-3 py-2.5 font-semibold text-slate-900 sm:px-4 sm:py-3">{row.companyName}</td>
                              <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-600 sm:px-4 sm:py-3 sm:text-sm">{row.lastOrderDate}</td>
                              <td className="px-3 py-2.5 text-right font-bold text-slate-950 sm:px-4 sm:py-3">{formatCurrency(row.ltv)}</td>
                              <td className="px-3 py-2.5 text-right sm:px-4 sm:py-3">{formatNumber(row.totalOrders)}</td>
                              <td className="hidden px-4 py-3 text-right sm:table-cell">{formatCurrency(row.aov)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <div className="p-5"><EmptyState title="No buyer data available" /></div>}
                </div>
              )}

              {/* SKU Perspective Table */}
              {macroPerspective === 'sku' && (
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                  {sortedMacroSkus.length ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                          <tr>
                            <SortableHeader label="Product" sortKey="description" activeSort={macroSort} onSort={toggleMacroSort} />
                            <SortableHeader label="Last Order" sortKey="lastOrderDate" activeSort={macroSort} onSort={toggleMacroSort} />
                            <SortableHeader label="LTV" sortKey="ltv" activeSort={macroSort} onSort={toggleMacroSort} className="text-right" />
                            <SortableHeader label="Orders" sortKey="totalOrders" activeSort={macroSort} onSort={toggleMacroSort} className="text-right" />
                            <SortableHeader label="Qty Sold" sortKey="totalQty" activeSort={macroSort} onSort={toggleMacroSort} className="text-right hidden sm:table-cell" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {sortedMacroSkus.map(row => (
                            <tr key={row.productId} onClick={() => navigateToAnalytics('sku', row.productId)} className="cursor-pointer hover:bg-slate-100 transition">
                              <td className="px-3 py-2.5 sm:px-4 sm:py-3"><span className="block font-semibold text-slate-900">{row.description}</span><span className="text-xs text-slate-500">{row.productId}</span></td>
                              <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-600 sm:px-4 sm:py-3 sm:text-sm">{row.lastOrderDate}</td>
                              <td className="px-3 py-2.5 text-right font-bold text-slate-950 sm:px-4 sm:py-3">{formatCurrency(row.ltv)}</td>
                              <td className="px-3 py-2.5 text-right sm:px-4 sm:py-3">{formatNumber(row.totalOrders)}</td>
                              <td className="hidden px-4 py-3 text-right sm:table-cell">{formatNumber(row.totalQty)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <div className="p-5"><EmptyState title="No SKU data available" /></div>}
                </div>
              )}
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

                  {/* Product filter */}
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

                {/* Buyer Profile Card */}
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
                        <div className="sm:col-span-2"><p className="font-semibold text-slate-500">Address</p><p className="font-medium text-slate-900">{selectedAnalyticsBuyer.address || '-'}</p></div>
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
                    <StatTile label="Orders" value={formatNumber(buyerAnalyticsStats.orderCount)} icon={History} tone="slate" />
                  </div>

                  {/* YoY SKU Variance Engine */}
                  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">YoY SKU Variance</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <FieldLabel>Baseline Year</FieldLabel>
                        <select value={yoyBaselineYear} onChange={e => setYoyBaselineYear(e.target.value)} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100">
                          <option value="">Select Year</option>
                          {buyerDateRangeOptions.filter(o => o !== 'All Time').map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <FieldLabel>Comparison Year</FieldLabel>
                        <select value={yoyComparisonYear} onChange={e => setYoyComparisonYear(e.target.value)} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100">
                          <option value="">Select Year</option>
                          {buyerDateRangeOptions.filter(o => o !== 'All Time').map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    </div>
                    {yoyBaselineYear && yoyComparisonYear && (
                      yoyVarianceData.length ? (
                        <div className="overflow-x-auto rounded-lg border border-slate-200">
                          <table className="min-w-full divide-y divide-slate-200 text-sm">
                            <thead className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                              <tr>
                                <th className="px-3 py-2.5 sm:px-4 sm:py-3">SKU</th>
                                <th className="px-3 py-2.5 text-right sm:px-4 sm:py-3">{yoyBaselineYear} Qty</th>
                                <th className="px-3 py-2.5 text-right sm:px-4 sm:py-3">{yoyComparisonYear} Qty</th>
                                <th className="px-3 py-2.5 text-right sm:px-4 sm:py-3">Variance (Δ)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {yoyVarianceData.map(row => (
                                <tr key={row.productId} className="hover:bg-slate-50">
                                  <td className="px-3 py-2.5 sm:px-4 sm:py-3"><span className="font-semibold text-slate-900">{row.description}</span><br/><span className="text-xs text-slate-500">{row.productId}</span></td>
                                  <td className="px-3 py-2.5 text-right sm:px-4 sm:py-3">{formatNumber(row.baselineQty)}</td>
                                  <td className="px-3 py-2.5 text-right sm:px-4 sm:py-3">{formatNumber(row.comparisonQty)}</td>
                                  <td className={`px-3 py-2.5 text-right font-bold sm:px-4 sm:py-3 ${row.variance > 0 ? 'text-emerald-600' : row.variance < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                                    {row.variance > 0 ? '+' : ''}{formatNumber(row.variance)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : <EmptyState title="No matching SKU data for the selected years" />
                    )}
                  </div>

                  {/* Sort bar for consolidated */}
                  {buyerViewMode === 'Consolidated' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500">Sort:</span>
                      {sortFields.map(f => <SortButton key={f.key} label={f.label} sortKey={f.key} activeSort={buyerSort} onToggle={toggleSort(setBuyerSort)} />)}
                    </div>
                  )}

                  {/* Transaction Logs */}
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


          {/* SKU ANALYTICS */}
          {activeTab === 'skuAnalytics' && (
            <section className="space-y-5">
              {/* SKU Selector + Profile */}
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="relative">
                    <FieldLabel>Select SKU</FieldLabel>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input type="text" value={skuAnalyticsSearch} onFocus={() => setDropdowns(p => ({ ...p, skuAnalyticsSku: true }))} onBlur={() => closeDropdownSoon('skuAnalyticsSku')} onChange={e => { setSkuAnalyticsSearch(e.target.value); setSelectedAnalyticsSkuId(''); }}
                        className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
                    </div>
                    {dropdowns.skuAnalyticsSku && (
                      <div className="absolute left-0 right-0 top-full z-10 mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                        {filteredSkuAnalyticsSkus.length ? filteredSkuAnalyticsSkus.map(s => (
                          <button key={s.productId} type="button" onMouseDown={e => e.preventDefault()} onClick={() => selectAnalyticsSku(s)}
                            className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5 text-left transition last:border-b-0 hover:bg-blue-50">
                            <span><span className="block text-sm font-semibold text-slate-900">{s.description}</span><span className="text-xs text-slate-500">{formatCurrency(s.defaultPrice)}</span></span>
                            <span className="text-xs font-bold text-blue-700">{s.productId}</span>
                          </button>
                        )) : <div className="px-4 py-3 text-sm text-slate-500">No SKUs found</div>}
                      </div>
                    )}
                  </div>
                </div>

                {/* SKU Profile Card */}
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  {selectedAnalyticsSku ? (
                    <div>
                      <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                        <div>
                          <p className="text-xs font-semibold uppercase text-slate-500">SKU Profile</p>
                          <h3 className="mt-1 text-lg font-bold text-slate-950">{selectedAnalyticsSku.description}</h3>
                        </div>
                        <StatusBadge tone="blue">{selectedAnalyticsSku.productId}</StatusBadge>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm">
                        <div><p className="font-semibold text-slate-500">Product ID</p><p className="font-medium text-slate-900">{selectedAnalyticsSku.productId}</p></div>
                        <div><p className="font-semibold text-slate-500">Target Default Price</p><p className="font-medium text-slate-900">{selectedAnalyticsSku.defaultPrice ? formatCurrency(selectedAnalyticsSku.defaultPrice) : '—'}</p></div>
                      </div>
                    </div>
                  ) : <EmptyState title="Select a SKU to view analytics" />}
                </div>
              </div>

              {selectedAnalyticsSku && (
                <>
                  {/* Grouping Toggle */}
                  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <FieldLabel>Grouping</FieldLabel>
                    <div className="grid h-11 max-w-xs grid-cols-2 rounded-lg border border-slate-300 bg-slate-100 p-1">
                      {buyerGroupModes.map(o => (
                        <button key={o} type="button" onClick={() => setSkuAnalyticsGrouping(o)} className={`rounded-md text-xs font-bold transition ${skuAnalyticsGrouping === o ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>{o}</button>
                      ))}
                    </div>
                  </div>

                  {/* Top Buyers Engine */}
                  <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Top Buyers for this SKU</h3>
                    </div>
                    {skuTopBuyers.length ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                          <thead className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                            <tr>
                              <th className="px-3 py-2.5 sm:px-4 sm:py-3">Company</th>
                              <th className="px-3 py-2.5 text-right sm:px-4 sm:py-3">Total Qty</th>
                              <th className="px-3 py-2.5 text-right sm:px-4 sm:py-3">Revenue</th>
                              <th className="hidden px-4 py-3 sm:table-cell">Last Purchase</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {skuTopBuyers.map(row => (
                              <tr key={row.buyerId} onClick={() => navigateToAnalytics('buyer', row.buyerId)} className="cursor-pointer hover:bg-slate-100 transition">
                                <td className="px-3 py-2.5 font-semibold text-slate-900 sm:px-4 sm:py-3">{row.companyName}</td>
                                <td className="px-3 py-2.5 text-right sm:px-4 sm:py-3">{formatNumber(row.totalQty)}</td>
                                <td className="px-3 py-2.5 text-right font-bold text-slate-950 sm:px-4 sm:py-3">{formatCurrency(row.totalRevenue)}</td>
                                <td className="hidden whitespace-nowrap px-4 py-3 text-slate-600 sm:table-cell">{row.lastPurchaseDate}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : <div className="p-5"><EmptyState title="No buyer data for this SKU" /></div>}
                  </div>

                  {/* Trend Engine */}
                  <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Trend ({skuAnalyticsGrouping})</h3>
                    </div>
                    {skuTrendData.length ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                          <thead className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                            <tr>
                              <th className="px-3 py-2.5 sm:px-4 sm:py-3">Period</th>
                              <th className="px-3 py-2.5 text-right sm:px-4 sm:py-3">Quantity</th>
                              <th className="px-3 py-2.5 text-right sm:px-4 sm:py-3">Revenue</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {skuTrendData.map(row => (
                              <tr key={row.period} className="hover:bg-slate-50">
                                <td className="px-3 py-2.5 font-semibold text-slate-900 sm:px-4 sm:py-3">{row.label}</td>
                                <td className="px-3 py-2.5 text-right sm:px-4 sm:py-3">{formatNumber(row.totalQty)}</td>
                                <td className="px-3 py-2.5 text-right font-bold text-slate-950 sm:px-4 sm:py-3">{formatCurrency(row.totalRevenue)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : <div className="p-5"><EmptyState title="No trend data for this SKU" /></div>}
                  </div>
                </>
              )}
            </section>
          )}


          {/* DASHBOARD */}
          {activeTab === 'dashboard' && (
            <section className="space-y-5">
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                <StatTile label="Revenue" value={formatCurrency(dashboardStats.revenue)} icon={BarChart3} tone="blue" />
                <StatTile label="Quantity" value={formatNumber(dashboardStats.quantity)} icon={Package} tone="emerald" />
                <StatTile label="Buyers" value={formatNumber(dashboardStats.buyerCount)} icon={Users} tone="amber" />
                <StatTile label="Orders" value={formatNumber(dashboardStats.orderCount)} icon={History} tone="slate" />
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

          {/* ADMIN PANEL */}
          {activeTab === 'admin' && isAdmin && (
            <section className="space-y-5">
              {/* Admin Stats */}
              <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
                <StatTile label="Total Users" value={formatNumber(adminUsers.length)} icon={Users} tone="blue" />
                <StatTile label="Active Users" value={formatNumber(adminUsers.filter(u => u.status === 'Active').length)} icon={CheckCircle2} tone="emerald" />
                <StatTile label="Pending Approvals" value={formatNumber(adminUsers.filter(u => u.status === 'Pending').length)} icon={Loader2} tone="amber" />
              </div>

              {/* User Management Table */}
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                {adminLoading ? (
                  <div className="flex items-center justify-center p-10">
                    <Loader2 className="animate-spin text-blue-600" size={24} />
                  </div>
                ) : adminUsers.length ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-3 py-2.5 sm:px-4 sm:py-3">Email</th>
                          <th className="hidden px-4 py-3 sm:table-cell">Name</th>
                          <th className="hidden px-4 py-3 md:table-cell">Phone</th>
                          <th className="px-3 py-2.5 sm:px-4 sm:py-3">Role</th>
                          <th className="px-3 py-2.5 sm:px-4 sm:py-3">Status</th>
                          <th className="px-3 py-2.5 sm:px-4 sm:py-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {adminUsers.map(user => (
                          <tr key={user.rowIndex} className="hover:bg-slate-50">
                            <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                              <span className="block font-medium text-slate-900">{user.email}</span>
                              <span className="block text-xs text-slate-500 sm:hidden">{user.name}{user.phone ? ` • ${user.phone}` : ''}</span>
                            </td>
                            <td className="hidden whitespace-nowrap px-4 py-3 font-medium text-slate-900 sm:table-cell">{user.name || '—'}</td>
                            <td className="hidden whitespace-nowrap px-4 py-3 text-slate-700 md:table-cell">{user.phone || '—'}</td>
                            <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${user.role === 'Admin' ? 'bg-purple-50 text-purple-700 ring-purple-200' : 'bg-slate-100 text-slate-700 ring-slate-200'}`}>
                                {user.role}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                                user.status === 'Active' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' :
                                user.status === 'Terminated' ? 'bg-red-50 text-red-700 ring-red-200' :
                                'bg-amber-50 text-amber-700 ring-amber-200'
                              }`}>
                                {user.status}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                              <div className="flex flex-wrap gap-2">
                                {user.status === 'Pending' && (
                                  <>
                                    <button type="button" disabled={adminUpdating === user.rowIndex} onClick={() => handleUserStatusChange(user.rowIndex, 'Active')}
                                      className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50">
                                      {adminUpdating === user.rowIndex ? <Loader2 className="animate-spin" size={12} /> : <Check size={12} />}Approve
                                    </button>
                                    <button type="button" disabled={adminUpdating === user.rowIndex} onClick={() => handleUserStatusChange(user.rowIndex, 'Terminated')}
                                      className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-50">
                                      {adminUpdating === user.rowIndex ? <Loader2 className="animate-spin" size={12} /> : <X size={12} />}Reject
                                    </button>
                                  </>
                                )}
                                {user.status === 'Active' && (
                                  <button type="button" disabled={adminUpdating === user.rowIndex} onClick={() => handleUserStatusChange(user.rowIndex, 'Terminated')}
                                    className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-50">
                                    {adminUpdating === user.rowIndex ? <Loader2 className="animate-spin" size={12} /> : <X size={12} />}Terminate
                                  </button>
                                )}
                                {user.status === 'Terminated' && (
                                  <button type="button" disabled={adminUpdating === user.rowIndex} onClick={() => handleUserStatusChange(user.rowIndex, 'Active')}
                                    className="inline-flex items-center gap-1 rounded-md bg-slate-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-slate-700 disabled:opacity-50">
                                    {adminUpdating === user.rowIndex ? <Loader2 className="animate-spin" size={12} /> : <RefreshCw size={12} />}Restore Access
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <div className="p-5"><EmptyState title="No users found in Authorized_Users sheet" /></div>}
              </div>
            </section>
          )}
        </div>
      </main>

      {visibleNote && <NotePopup note={visibleNote} onClose={() => setVisibleNote(null)} />}
    </div>
  );
}
