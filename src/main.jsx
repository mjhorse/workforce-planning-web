import React, { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ReactECharts from 'echarts-for-react';
import { BarChart3, BookOpen, BriefcaseBusiness, FileText, PieChart, Settings, Users } from 'lucide-react';
import './styles.css';

const toNumber = value => Number(String(value ?? 0).replace(/[wW万人天,]/g, '')) || 0;
const demandStatusOptions = ['待评估', '已排期', '开发中', '已上线', '已验收'];
const priorityOptions = ['紧急', '高', '一般'];
const demandTypeOptions = ['产品立项规划', '重要用户', '临时紧急需求', 'DFx需求', '存量运营维护/差评/零星需求'];
const demandTypeAliases = { DFX需求: 'DFx需求', DFX: 'DFx需求', DFX类需求: 'DFx需求', 存量运营维护: '存量运营维护/差评/零星需求', 差评需求: '存量运营维护/差评/零星需求', 零星需求: '存量运营维护/差评/零星需求' };
const priorityAliases = { P0: '紧急', P1: '紧急', P2: '高', P3: '一般', P4: '一般' };
const demandPartyOptions = ['制造', '审计', '供应', '财经', '采购', '行政', 'CBG', '部门基线（OBP/存量/差评等）', 'GPO'];
const personnelTypeOptions = ['OD', 'TM', '其他'];
const personnelPositionOptions = ['设计', '前端', '后端', '数据', 'UX', '测试', 'PM'];
const budgetStatusOptions = ['无预算', '已承诺未获取', '已获取', '获取超期'];
const budgetStatusAliases = { 已承诺: '已承诺未获取', 已超期: '获取超期', 预算已超期: '获取超期' };
const isBudgetCommitted = status => status === '已承诺未获取' || status === '获取超期';
const hasBudget = d => (d.budgetStatus || '') !== '无预算';
const demandPartyAliases = { 部门自投: '部门基线（OBP/存量/差评等）', 部门基线: '部门基线（OBP/存量/差评等）', 部门非基线: 'GPO' };
const rrPattern = /^RR\d{13}$/;
const rrInputPattern = /^(|R|RR|RR\d{0,13})$/;
const formatRr = value => String(value ?? '').trim().toUpperCase();
const isValidRr = value => rrPattern.test(formatRr(value));
const isValidRrInput = value => rrInputPattern.test(formatRr(value));
const rrFormatText = '需求单号格式：RRYYYYMMDD随机5位数，例如 RR2026053012345';
const validateDemand = (d, existingDemands = [], currentId = null) => {
  const demandNo = formatRr(d.demandNo);
  if (!demandNo) return '请填写需求单号';
  if (!isValidRr(demandNo)) return rrFormatText;
  if (existingDemands.some(item => item.id !== currentId && formatRr(item.demandNo || item.rr) === demandNo)) return `需求单号不能重复：${demandNo}`;
  return '';
};
const getDuplicateDemandNos = demands => {
  const seen = new Set();
  const duplicates = new Set();
  demands.forEach(d => {
    const demandNo = formatRr(d.demandNo || d.rr);
    if (!demandNo) return;
    if (seen.has(demandNo)) duplicates.add(demandNo);
    seen.add(demandNo);
  });
  return [...duplicates];
};
const statusAliases = { 待启动: '待评估', 进行中: '开发中', 已承诺: '已排期', 暂停: '待评估' };
const isScheduled = status => ['已排期', '开发中', '已上线', '已验收'].includes(status);
const normalizeDemand = d => {
  const status = statusAliases[d.status] || d.status || '待评估';
  const source = demandTypeAliases[d.source] || d.source || '产品立项规划';
  const demandNo = formatRr(d.demandNo || d.rr);
  const rawBudgetStatus = budgetStatusAliases[d.budgetStatus] || d.budgetStatus;
  const budgetStatus = budgetStatusOptions.includes(rawBudgetStatus) ? rawBudgetStatus : (d.committed ? '已承诺未获取' : (d.funded || toNumber(d.budget) > 0 ? '已获取' : '无预算'));
  const funded = budgetStatus !== '无预算';
  const workloadMode = d.workloadMode === 'breakdown' ? 'breakdown' : 'total';
  const breakdownDays = toNumber(d.analysis) + toNumber(d.frontend) + toNumber(d.middle) + toNumber(d.backend);
  return {
    ...d,
    status,
    source,
    demandNo,
    rr: demandNo,
    demandBA: d.demandBA || d.ba || '',
    demandPM: d.demandPM || d.pm || d.executor || '',
    priority: priorityAliases[d.priority] || d.priority || '一般',
    investment: demandPartyAliases[d.investment] || d.investment || '',
    version: isScheduled(status) ? (d.version || '') : '',
    budgetStatus,
    budgetContact: budgetStatus !== '无预算' ? (d.budgetContact || '') : '',
    budgetEta: isBudgetCommitted(budgetStatus) ? (d.budgetEta || '') : '',
    budgetAcquiredDate: budgetStatus === '已获取' ? (d.budgetAcquiredDate || '') : '',
    workloadMode,
    days: workloadMode === 'breakdown' ? breakdownDays : toNumber(d.days),
    finalDays: status === '已验收' ? toNumber(d.finalDays) : 0,
    committed: isBudgetCommitted(budgetStatus),
    settlementDays: toNumber(d.settlementDays),
    acceptanceCriteria: d.acceptanceCriteria || d.acceptance || ''
  };
};

const budgetDashboardStatuses = ['无预算', '已承诺未获取', '已获取', '已结算'];
const budgetPoolTypes = [
  ['demand-side', '需求方预算'],
  ['department-baseline', '部门基线预算'],
  ['other', '其他']
];
const budgetPoolTypeLabels = Object.fromEntries(budgetPoolTypes);
const unmatchedBudgetPoolName = '未匹配预算池';
const budgetRiskColors = { 无预算: '#dc2626', 已承诺未获取: '#f97316', 已获取: '#16a34a', 已结算: '#166534' };
const riskLevelMeta = {
  high: { text: '高风险', color: '#dc2626' },
  medium: { text: '中风险', color: '#f97316' },
  low: { text: '低风险', color: '#16a34a' }
};
const riskLevelRank = { low: 1, medium: 2, high: 3 };

const getDaysTo = date => {
  const time = date ? new Date(date).getTime() : 0;
  return time ? Math.ceil((time - Date.now()) / 86400000) : Infinity;
};
const isPastDate = date => Number.isFinite(getDaysTo(date)) && getDaysTo(date) < 0;
const hasBudgetAcquired = row => ['已获取', '已结算'].includes(row.dashboardBudgetStatus);

const riskRules = [
  { id: 'HIGH-URGENT-NO-BUDGET', name: '紧急需求无预算', level: 'high', category: '预算覆盖', description: '优先级为紧急且当前预算状态为无预算；紧急表示需下个版本完成。', action: '优先补齐预算或调整落地范围', match: row => row.dashboardBudgetStatus === '无预算' && row.priority === '紧急' },
  { id: 'HIGH-BUDGET-OVERDUE', name: '预算获取超期', level: 'high', category: '预算时效', description: '需求预算状态被标记为获取超期。', action: '升级预算接口人并明确获取日期', match: row => row.budgetStatus === '获取超期' },
  { id: 'HIGH-LANDING-30-NO-BUDGET', name: '近 30 天落地但预算未获取', level: 'high', category: '预算时效', description: '计划落地日期在 30 天内，且预算尚未获取或结算。', action: '优先补齐预算或调整落地范围', match: (row, ctx) => ctx.daysToLanding >= 0 && ctx.daysToLanding <= 30 && !hasBudgetAcquired(row) },
  { id: 'HIGH-ETA-PAST-NO-BUDGET', name: '预算承诺日期已过但仍未获取', level: 'high', category: '预算时效', description: '预算承诺日期已经过去，且预算尚未获取或结算。', action: '升级预算承诺兑现并更新日期', match: row => row.budgetEta && isPastDate(row.budgetEta) && !hasBudgetAcquired(row) },
  { id: 'HIGH-IN-PROGRESS-NO-BUDGET', name: '开发中/已上线但预算未获取', level: 'high', category: '进度状态', description: '需求已进入开发中或已上线状态，但预算尚未获取或结算。', action: '暂停新增投入前确认预算闭环', match: row => ['开发中', '已上线'].includes(row.status) && !hasBudgetAcquired(row) },
  { id: 'HIGH-ACCEPTED-NO-SETTLEMENT', name: '已验收但未结算', level: 'high', category: '结算闭环', description: '需求状态为已验收，但结算人力尚未填写。', action: '补齐结算人力并完成预算结算', match: row => row.status === '已验收' && toNumber(row.settlementDays) <= 0 },
  { id: 'MEDIUM-COMMITTED-NO-ETA', name: '已承诺未获取但没有预算承诺日期', level: 'medium', category: '预算时效', description: '预算处于已承诺未获取或获取超期状态，但未填写预算承诺日期。', action: '补充预算承诺日期并跟踪兑现', match: row => row.dashboardBudgetStatus === '已承诺未获取' && !row.budgetEta },
  { id: 'MEDIUM-LANDING-60-NO-BUDGET', name: '60 天内落地但预算未获取', level: 'medium', category: '预算时效', description: '计划落地日期在 60 天内，且预算尚未获取或结算。', action: '纳入周度预算跟踪清单', match: (row, ctx) => ctx.daysToLanding >= 0 && ctx.daysToLanding <= 60 && !hasBudgetAcquired(row) },
  { id: 'MEDIUM-LARGE-DAYS-NO-BUDGET', name: '人天较大且预算未获取', level: 'medium', category: '预算覆盖', description: '预估人天达到 80 人天及以上，且预算尚未获取或结算。', action: '复核预算金额与人天口径', match: row => row.days >= 80 && !hasBudgetAcquired(row) },
  { id: 'MEDIUM-BUDGET-LESS-THAN-COST', name: '已获取预算低于估算成本', level: 'medium', category: '预算覆盖', description: '已获取预算金额小于按预算配置中人天成本口径估算的需求成本。', action: '复核预算金额与人天口径', match: row => hasBudgetAcquired(row) && row.budget < row.estimatedCost },
  { id: 'HIGH-NO-BUDGET-POOL', name: '需求无匹配预算池', level: 'high', category: '预算池', description: '需求方或预算池ID无法匹配任何预算池，预算扣减来源不明确。', action: '维护预算池所属方，或在需求中补齐需求方', match: row => !row.matchedBudgetPool },
  { id: 'HIGH-POOL-OVERSPENT-ACTIVE', name: '预算池超额仍有执行需求', level: 'high', category: '预算池', description: '匹配预算池已超额，且需求仍处于已排期、开发中或已上线状态。', action: '暂停新增投入或追加预算池额度', match: row => row.poolOverBudget && ['已排期', '开发中', '已上线'].includes(row.status) },
  { id: 'MEDIUM-DEMAND-BUDGET-OVER-POOL-REMAINING', name: '需求预算超过预算池剩余额度', level: 'medium', category: '预算池', description: '单需求预算金额大于匹配预算池剩余额度。', action: '拆分需求范围或确认追加预算', match: row => row.matchedBudgetPool && row.budget > Math.max(0, row.poolRemaining) },
  { id: 'MEDIUM-LANDING-30-POOL-INSUFFICIENT', name: '近30天落地预算池不足', level: 'medium', category: '预算池', description: '近30天计划落地需求的匹配预算池剩余额度不足。', action: '优先确认预算池追加或调整排期', match: (row, ctx) => ctx.daysToLanding >= 0 && ctx.daysToLanding <= 30 && row.matchedBudgetPool && row.poolRemaining < row.estimatedCost },
  { id: 'LOW-FAR-LANDING-TRACKING', name: '距离落地较远但预算仍需跟踪', level: 'low', category: '预算时效', description: '计划落地日期超过 60 天，预算尚未获取，需保持常规跟踪。', action: '保持月度预算跟踪节奏', match: (row, ctx) => ctx.daysToLanding > 60 && !hasBudgetAcquired(row) },
  { id: 'LOW-ACQUIRED-AFTER-LANDING', name: '预算获取日晚于需求期望完成日期', level: 'low', category: '预算时效', description: '预算获取日期晚于计划落地日期，需复盘预算获取节奏但当前作为低风险观察。', action: '复盘预算获取节奏，后续提前锁定预算', match: row => row.budgetAcquiredDate && row.landingDate && row.budgetAcquiredDate > row.landingDate },
  { id: 'LOW-NO-HIGH-MEDIUM', name: '未命中高/中风险规则', level: 'low', category: '兜底提示', description: '未触发高风险或中风险规则，作为低风险需求持续观察。', action: '保持当前预算跟踪节奏', match: () => true }
];

function getDashboardBudgetStatus(d) {
  if (d.budgetStatus === '无预算' || toNumber(d.budget) <= 0) return '无预算';
  if (d.status === '已验收' && toNumber(d.settlementDays) > 0) return '已结算';
  if (d.budgetStatus === '已获取') return '已获取';
  return '已承诺未获取';
}

function getBudgetDayCost(budget) {
  return toNumber(budget.dayCost || budget.costPerDay || 0.12);
}

function getCurrentMonthKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function buildMonthOptions(demands) {
  const currentYear = new Date().getFullYear();
  const months = new Set(Array.from({ length: 12 }, (_, idx) => `${currentYear}-${String(idx + 1).padStart(2, '0')}`));
  demands.forEach(d => { if (d.landingDate) months.add(String(d.landingDate).slice(0, 7)); });
  return [...months].sort();
}

function formatMonthLabel(month) {
  const [year, value] = String(month).split('-');
  return year && value ? `${year}年${value}月` : month;
}

function MonthSelect({ value, onChange, options, emptyLabel = '不限' }) {
  return <select value={value} onChange={e=>onChange(e.target.value)}><option value="">{emptyLabel}</option>{options.map(month => <option key={month} value={month}>{formatMonthLabel(month)}</option>)}</select>;
}

function getSortValue(row, key) {
  const value = row?.[key];
  if (React.isValidElement(value)) return '';
  return value ?? '';
}

function isBlankSortValue(value) {
  if (React.isValidElement(value)) return true;
  return String(value ?? '').trim() === '';
}

function compareSortValues(a, b) {
  const left = String(a ?? '').trim();
  const right = String(b ?? '').trim();
  const leftNumber = toNumber(left);
  const rightNumber = toNumber(right);
  const leftLooksNumber = left !== '' && /^-?[\d,.]+(?:\.\d+)?[wW万人天%]*$/.test(left);
  const rightLooksNumber = right !== '' && /^-?[\d,.]+(?:\.\d+)?[wW万人天%]*$/.test(right);
  if (leftLooksNumber && rightLooksNumber) return leftNumber - rightNumber;
  if (/^\d{4}-\d{2}(-\d{2})?$/.test(left) && /^\d{4}-\d{2}(-\d{2})?$/.test(right)) return left.localeCompare(right);
  return left.localeCompare(right, 'zh-CN', { numeric: true });
}

function sortRows(rows, sort) {
  if (!sort?.key) return rows;
  return [...rows].sort((a, b) => {
    const left = getSortValue(a, sort.key);
    const right = getSortValue(b, sort.key);
    const leftBlank = isBlankSortValue(left);
    const rightBlank = isBlankSortValue(right);
    if (leftBlank && rightBlank) return 0;
    if (leftBlank) return 1;
    if (rightBlank) return -1;
    return compareSortValues(left, right) * (sort.direction === 'asc' ? 1 : -1);
  });
}

function toggleSort(sort, key) {
  return sort.key === key ? { key, direction: sort.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' };
}

function getDemandMonth(d) {
  return d.landingDate ? String(d.landingDate).slice(0, 7) : '未排期';
}

function getExecutionDays(d) {
  const finalDays = toNumber(d.finalDays);
  if (finalDays > 0) return finalDays;
  const settlementDays = toNumber(d.settlementDays);
  if (d.status === '已验收' && settlementDays > 0) return settlementDays;
  return toNumber(d.days);
}

function getExecutionStage(d) {
  if (d.status === '已验收') return '已结算/验收';
  if (['已排期', '开发中', '已上线'].includes(d.status)) return '已排期/执行中';
  return '后续需求';
}

function getMonthlyCapacityDays(budget) {
  return toNumber(budget.monthlyWorkdays) || 22.5;
}

function getDemandExecutionCost(d, budget) {
  return getExecutionDays(d) * getBudgetDayCost(budget);
}

function getBudgetPoolAmount(pool) {
  return toNumber(pool?.amount);
}

function getBudgetOccupationMonth(demand) {
  if (demand.budgetStatus === '已获取' && demand.budgetAcquiredDate) return String(demand.budgetAcquiredDate).slice(0, 7);
  if (isBudgetCommitted(demand.budgetStatus) && demand.budgetEta) return String(demand.budgetEta).slice(0, 7);
  if (demand.landingDate) return String(demand.landingDate).slice(0, 7);
  return '未计划';
}

function matchDemandBudgetPool(demand, pools = []) {
  const normalizedPools = Array.isArray(pools) ? pools : [];
  if (demand.budgetPoolId) {
    const byId = normalizedPools.find(pool => String(pool.id) === String(demand.budgetPoolId));
    if (byId) return byId;
  }
  const investment = String(demand.investment || '').trim();
  if (!investment) return null;
  return normalizedPools.find(pool => [pool.ownerDept, pool.name].some(value => String(value || '').includes(investment) || investment.includes(String(value || '')))) || null;
}

function getBudgetPoolStatus(amount, occupied) {
  if (amount <= 0 && occupied > 0) return '无预算池';
  if (occupied > amount) return '已超额';
  if (amount > 0 && occupied >= amount) return '已用尽';
  if (amount > 0 && occupied / amount >= 0.85) return '接近用尽';
  return '正常';
}

function buildBudgetPoolRows(demands, budget) {
  const pools = Array.isArray(budget?.pools) ? budget.pools : [];
  const rows = new Map(pools.map(pool => [String(pool.id), {
    id: pool.id,
    name: pool.name || '未命名预算池',
    ownerDept: pool.ownerDept || '',
    type: pool.type || 'other',
    typeLabel: budgetPoolTypeLabels[pool.type] || budgetPoolTypeLabels.other,
    month: pool.month || '年度/长期',
    description: pool.description || '',
    amount: getBudgetPoolAmount(pool),
    demandCount: 0,
    demandBudget: 0,
    executionCost: 0,
    executedCost: 0,
    scheduledCost: 0,
    laterCost: 0,
    executedDays: 0,
    scheduledDays: 0,
    laterDays: 0,
    noBudgetCount: 0,
    overBudgetDemandCount: 0,
    demandIds: []
  }]));
  const unmatchedKey = '__unmatched__';
  rows.set(unmatchedKey, { id: unmatchedKey, name: unmatchedBudgetPoolName, ownerDept: '未匹配', type: 'other', typeLabel: '未匹配', month: '未匹配', description: '需求方或预算池ID无法匹配预算池', amount: 0, demandCount: 0, demandBudget: 0, executionCost: 0, executedCost: 0, scheduledCost: 0, laterCost: 0, executedDays: 0, scheduledDays: 0, laterDays: 0, noBudgetCount: 0, overBudgetDemandCount: 0, demandIds: [] });
  demands.forEach(d => {
    const pool = matchDemandBudgetPool(d, pools);
    const key = pool ? String(pool.id) : unmatchedKey;
    const row = rows.get(key);
    const demandBudget = toNumber(d.budget);
    const executionDays = getExecutionDays(d);
    const executionCost = getDemandExecutionCost(d, budget);
    const stage = getExecutionStage(d);
    row.demandCount += 1;
    row.demandBudget += demandBudget;
    row.executionCost += executionCost;
    row.demandIds.push(d.id);
    if (demandBudget <= 0) row.noBudgetCount += 1;
    if (executionCost > demandBudget && executionCost > 0) row.overBudgetDemandCount += 1;
    if (stage === '已结算/验收') { row.executedCost += executionCost; row.executedDays += executionDays; }
    else if (stage === '已排期/执行中') { row.scheduledCost += executionCost; row.scheduledDays += executionDays; }
    else { row.laterCost += executionCost; row.laterDays += executionDays; }
  });
  return [...rows.values()].filter(row => row.id !== unmatchedKey || row.demandCount > 0).map(row => {
    const remaining = row.amount - row.demandBudget;
    const executionRemaining = row.amount - row.executionCost;
    const usageRate = row.amount > 0 ? row.demandBudget / row.amount : (row.demandBudget > 0 ? Infinity : 0);
    const executionRate = row.amount > 0 ? row.executionCost / row.amount : (row.executionCost > 0 ? Infinity : 0);
    const status = getBudgetPoolStatus(row.amount, row.demandBudget);
    return { ...row, remaining, executionRemaining, usageRate, executionRate, status, totalExecutionCost: row.executionCost, source: row.name };
  }).sort((a, b) => (a.id === unmatchedKey ? 1 : b.id === unmatchedKey ? -1 : b.demandBudget - a.demandBudget));
}

function buildMonthlyBudgetOccupationRows(demands, budget) {
  const monthMap = new Map();
  (budget?.pools || []).forEach(pool => {
    const month = pool.month || '年度/长期';
    if (month === '年度/长期') return;
    const row = monthMap.get(month) || { month, poolAmount: 0, demandBudget: 0, executionCost: 0, demandCount: 0, demandIds: [] };
    row.poolAmount += getBudgetPoolAmount(pool);
    monthMap.set(month, row);
  });
  demands.forEach(d => {
    const month = getBudgetOccupationMonth(d);
    const row = monthMap.get(month) || { month, poolAmount: 0, demandBudget: 0, executionCost: 0, demandCount: 0, demandIds: [] };
    row.demandBudget += toNumber(d.budget);
    row.executionCost += getDemandExecutionCost(d, budget);
    row.demandCount += 1;
    row.demandIds.push(d.id);
    monthMap.set(month, row);
  });
  let cumulativeDemandBudget = 0;
  let cumulativeExecutionCost = 0;
  let cumulativePoolAmount = 0;
  return [...monthMap.values()].sort((a, b) => sortBudgetPlanMonth(a.month, b.month)).map(row => {
    cumulativeDemandBudget += row.demandBudget;
    cumulativeExecutionCost += row.executionCost;
    cumulativePoolAmount += row.poolAmount;
    const remaining = cumulativePoolAmount - cumulativeDemandBudget;
    const overAmount = Math.max(0, -remaining);
    const status = getBudgetPoolStatus(cumulativePoolAmount, cumulativeDemandBudget);
    return { ...row, cumulativeDemandBudget, cumulativeExecutionCost, cumulativePoolAmount, remaining, overAmount, status };
  });
}

function buildBudgetOccupationDemandRows(demands, budget) {
  const poolRows = buildBudgetPoolRows(demands, budget);
  const poolRowById = new Map(poolRows.map(row => [String(row.id), row]));
  return demands.map(d => {
    const pool = matchDemandBudgetPool(d, budget?.pools || []);
    const poolRow = pool ? poolRowById.get(String(pool.id)) : null;
    const budgetAmount = toNumber(d.budget);
    const executionCost = getDemandExecutionCost(d, budget);
    return {
      ...d,
      demandId: d.demandNo || d.rr || d.id,
      source: d.source || '未填写类型',
      investment: d.investment || '未填写需求方',
      budgetPoolId: pool?.id || '',
      budgetPoolName: pool?.name || unmatchedBudgetPoolName,
      matchedBudgetPool: Boolean(pool),
      budgetAmount,
      executionCost,
      budgetStatusLabel: d.budgetStatus || '无预算',
      occupationMonth: getBudgetOccupationMonth(d),
      demandBA: d.demandBA || '未填写BA',
      demandPM: d.demandPM || '未填写PM',
      poolStatus: poolRow?.status || '无预算池',
      poolRemaining: poolRow?.remaining ?? 0,
      poolOverBudget: (poolRow?.remaining ?? 0) < 0,
      budgetInsufficient: executionCost > budgetAmount || (poolRow?.remaining ?? 0) < 0
    };
  }).sort((a, b) => sortBudgetPlanMonth(a.occupationMonth, b.occupationMonth) || String(a.demandId).localeCompare(String(b.demandId)));
}

function buildBudgetPoolSummary(poolRows, monthlyRows) {
  const totalAmount = poolRows.reduce((s, r) => s + (r.id === '__unmatched__' ? 0 : r.amount), 0);
  const demandBudget = poolRows.reduce((s, r) => s + r.demandBudget, 0);
  const executionCost = poolRows.reduce((s, r) => s + r.executionCost, 0);
  const remaining = totalAmount - demandBudget;
  const overPoolCount = poolRows.filter(r => ['已超额', '无预算池'].includes(r.status)).length;
  const overMonthCount = monthlyRows.filter(r => r.overAmount > 0).length;
  return { totalAmount, demandBudget, executionCost, remaining, overPoolCount, overMonthCount };
}


function buildDemandBudgetSourceRows(demands, budget) {
  const rows = new Map();
  demands.forEach(d => {
    const source = d.investment || '未填写需求方';
    const pool = matchDemandBudgetPool(d, budget?.pools || []);
    const key = source;
    const row = rows.get(key) || { source, demandCount: 0, budgetAmount: 0, executionCost: 0, executionDays: 0, acquired: 0, committed: 0, overdue: 0, noBudgetCount: 0, matchedPoolNames: new Set(), demandIds: [] };
    const budgetAmount = toNumber(d.budget);
    row.demandCount += 1;
    row.budgetAmount += budgetAmount;
    row.executionCost += getDemandExecutionCost(d, budget);
    row.executionDays += getExecutionDays(d);
    row.demandIds.push(d.id);
    if (pool) row.matchedPoolNames.add(pool.name);
    if (d.budgetStatus === '已获取') row.acquired += budgetAmount;
    else if (d.budgetStatus === '获取超期') row.overdue += budgetAmount;
    else if (d.budgetStatus === '已承诺未获取') row.committed += budgetAmount;
    else row.noBudgetCount += 1;
    rows.set(key, row);
  });
  return [...rows.values()].map(row => ({ ...row, matchedPoolsText: [...row.matchedPoolNames].join('、') || unmatchedBudgetPoolName })).sort((a, b) => b.budgetAmount - a.budgetAmount);
}

function buildBudgetSourceSummary(sourceRows, baselinePools) {
  return {
    sourceCount: sourceRows.length,
    demandBudget: sourceRows.reduce((s, r) => s + r.budgetAmount, 0),
    executionCost: sourceRows.reduce((s, r) => s + r.executionCost, 0),
    noBudgetCount: sourceRows.reduce((s, r) => s + r.noBudgetCount, 0),
    baselineAmount: baselinePools.reduce((s, p) => s + getBudgetPoolAmount(p), 0)
  };
}

function evaluateRiskRules(row, dayCost = 0.12) {
  const context = { dayCost, daysToLanding: getDaysTo(row.landingDate), daysToBudgetEta: getDaysTo(row.budgetEta) };
  const matched = riskRules.filter(rule => rule.id !== 'LOW-NO-HIGH-MEDIUM' && rule.match(row, context));
  return matched.length ? matched : [riskRules.find(rule => rule.id === 'LOW-NO-HIGH-MEDIUM')];
}

function getBudgetRiskInfo(row, dayCost = 0.12) {
  const triggeredRules = evaluateRiskRules(row, dayCost);
  const riskLevel = triggeredRules.reduce((level, rule) => riskLevelRank[rule.level] > riskLevelRank[level] ? rule.level : level, 'low');
  return {
    level: riskLevel,
    text: riskLevelMeta[riskLevel].text,
    reason: triggeredRules.map(rule => rule.name).join('；'),
    action: [...new Set(triggeredRules.map(rule => rule.action))].join('；'),
    triggeredRules
  };
}

function buildBudgetRiskRows(demands, budget) {
  const dayCost = getBudgetDayCost(budget);
  const poolRows = buildBudgetPoolRows(demands, budget);
  const poolRowById = new Map(poolRows.map(row => [String(row.id), row]));
  return demands.map(d => {
    const budgetStatus = getDashboardBudgetStatus(d);
    const days = toNumber(d.days);
    const actualBudget = toNumber(d.budget);
    const estimatedCost = days * dayCost;
    const pool = matchDemandBudgetPool(d, budget?.pools || []);
    const poolRow = pool ? poolRowById.get(String(pool.id)) : null;
    const row = {
      ...d,
      days,
      budget: actualBudget,
      estimatedCost,
      budgetGap: Math.max(0, estimatedCost - actualBudget),
      settlementDays: toNumber(d.settlementDays),
      dashboardBudgetStatus: budgetStatus,
      budgetStatusLabel: budgetStatus,
      month: d.landingDate ? String(d.landingDate).slice(0, 7) : '未排期',
      daysToLanding: getDaysTo(d.landingDate),
      daysToBudgetEta: getDaysTo(d.budgetEta),
      budgetPoolName: pool?.name || unmatchedBudgetPoolName,
      matchedBudgetPool: Boolean(pool),
      poolRemaining: poolRow?.remaining ?? 0,
      poolOverBudget: (poolRow?.remaining ?? 0) < 0,
      poolStatus: poolRow?.status || '无预算池'
    };
    const risk = getBudgetRiskInfo(row, dayCost);
    return { ...row, triggeredRules: risk.triggeredRules, riskRuleCount: risk.triggeredRules.length, riskLevel: risk.level, riskText: risk.text, riskReason: risk.reason, action: risk.action };
  });
}

function buildBudgetRiskSummary(rows, budget) {
  const totalDays = rows.reduce((s, r) => s + r.days, 0);
  const demandBudget = rows.reduce((s, r) => s + r.budget, 0);
  const estimatedCost = rows.reduce((s, r) => s + r.estimatedCost, 0);
  const gapDays = rows.filter(r => ['无预算', '已承诺未获取'].includes(r.dashboardBudgetStatus) || r.riskLevel !== 'low').reduce((s, r) => s + r.days, 0);
  const highRiskCount = rows.filter(r => r.riskLevel === 'high').length;
  const mediumRiskCount = rows.filter(r => r.riskLevel === 'medium').length;
  const triggeredRuleCount = rows.reduce((s, r) => s + r.riskRuleCount, 0);
  const budgetGap = rows.reduce((s, r) => s + r.budgetGap, 0);
  const amountGap = Math.max(0, toNumber(budget.consumedCost) + estimatedCost - toNumber(budget.annualBudget));
  return { totalCount: rows.length, totalDays, gapDays, highRiskCount, mediumRiskCount, triggeredRuleCount, demandBudget, estimatedCost, budgetGap, amountGap };
}

function buildStatusBudgetOption(rows) {
  const totalsByStatus = new Map();
  demandStatusOptions.forEach(status => totalsByStatus.set(status, rows.filter(r => r.status === status).reduce((s, r) => s + r.days, 0)));
  return {
    color: budgetDashboardStatuses.map(s => budgetRiskColors[s]),
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: value => `${value} 人天` },
    legend: { top: 0 },
    grid: { left: 72, right: 46, top: 42, bottom: 28 },
    xAxis: { type: 'value', name: '人天' },
    yAxis: { type: 'category', data: demandStatusOptions },
    series: budgetDashboardStatuses.map(status => ({
      name: status,
      type: 'bar',
      stack: 'budget',
      data: demandStatusOptions.map(demandStatus => rows.filter(r => r.status === demandStatus && r.dashboardBudgetStatus === status).reduce((s, r) => s + r.days, 0)),
      itemStyle: status === '无预算' ? { color: budgetRiskColors[status], decal: { symbol: 'line', dashArrayX: [1, 0], dashArrayY: [2, 5], rotation: Math.PI / 4, color: 'rgba(255,255,255,.65)' } } : { color: budgetRiskColors[status] },
      label: status === '已结算' ? { show: true, position: 'right', formatter: params => totalsByStatus.get(params.name) ? `${totalsByStatus.get(params.name)} 人天` : '' } : undefined
    }))
  };
}

function buildBudgetDonutOption(rows) {
  const countData = budgetDashboardStatuses.map(status => ({ name: status, value: rows.filter(r => r.dashboardBudgetStatus === status).length, itemStyle: { color: budgetRiskColors[status] } }));
  const dayData = budgetDashboardStatuses.map(status => ({ name: status, value: rows.filter(r => r.dashboardBudgetStatus === status).reduce((s, r) => s + r.days, 0), itemStyle: { color: budgetRiskColors[status] } }));
  const gapDays = rows.filter(r => ['无预算', '已承诺未获取'].includes(r.dashboardBudgetStatus)).reduce((s, r) => s + r.days, 0);
  return {
    tooltip: { trigger: 'item', formatter: '{a}<br/>{b}: {c} ({d}%)' },
    legend: { bottom: 0 },
    graphic: [{ type: 'text', left: 'center', top: '45%', style: { text: `预算缺口\n${gapDays} 人天`, textAlign: 'center', fill: '#172033', fontSize: 16, fontWeight: 700 } }],
    series: [
      { name: '需求数', type: 'pie', radius: ['34%', '48%'], label: { formatter: '{b}\n{c}个' }, data: countData },
      { name: '人力', type: 'pie', radius: ['58%', '74%'], label: { formatter: '{b}\n{c}人天' }, data: dayData }
    ]
  };
}

function buildBudgetGapOption(rows, budget) {
  const annualBudget = toNumber(budget.annualBudget);
  const consumedCost = toNumber(budget.consumedCost);
  const estimatedCost = rows.reduce((s, r) => s + r.estimatedCost, 0);
  const gap = Math.max(0, consumedCost + estimatedCost - annualBudget);
  const names = ['全年预算', '已消耗', '需求成本估算', '预算缺口'];
  const values = [annualBudget, consumedCost, Number(estimatedCost.toFixed(1)), Number(gap.toFixed(1))];
  return {
    color: ['#2563eb', '#64748b', '#f97316', '#dc2626'],
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: params => params.map(p => `${p.name}: ${p.value}w`).join('<br/>') + `<br/>口径：${getBudgetDayCost(budget)}w/人天` + '<br/>单位：w' },
    grid: { left: 46, right: 24, top: 26, bottom: 38 },
    xAxis: { type: 'category', data: names },
    yAxis: { type: 'value', name: 'w' },
    series: [{ type: 'bar', data: values.map((value, idx) => ({ value, itemStyle: { color: ['#2563eb', '#64748b', '#f97316', '#dc2626'][idx] } })), label: { show: true, position: 'top', formatter: '{c}w' } }]
  };
}

function buildBudgetTrendOption(rows) {
  const months = [...new Set(rows.map(r => r.month))].sort((a, b) => a === '未排期' ? 1 : b === '未排期' ? -1 : a.localeCompare(b));
  const sum = (month, predicate) => rows.filter(r => r.month === month && predicate(r)).reduce((s, r) => s + r.days, 0);
  return {
    color: ['#2563eb', '#16a34a', '#dc2626'],
    tooltip: { trigger: 'axis', valueFormatter: value => `${value} 人天` },
    legend: { top: 0 },
    grid: { left: 48, right: 24, top: 42, bottom: 38 },
    xAxis: { type: 'category', data: months },
    yAxis: { type: 'value', name: '人天' },
    series: [
      { name: '总需求人力', type: 'line', smooth: true, data: months.map(month => sum(month, () => true)) },
      { name: '已获取/已结算人力', type: 'line', smooth: true, data: months.map(month => sum(month, r => ['已获取', '已结算'].includes(r.dashboardBudgetStatus))) },
      { name: '缺口人力', type: 'line', smooth: true, data: months.map(month => sum(month, r => ['无预算', '已承诺未获取'].includes(r.dashboardBudgetStatus))) }
    ]
  };
}

function buildRiskLevelOption(rows) {
  const data = ['high', 'medium', 'low'].map(level => ({ name: riskLevelMeta[level].text, value: rows.filter(r => r.riskLevel === level).length, itemStyle: { color: riskLevelMeta[level].color } }));
  return { tooltip: { trigger: 'item', formatter: '{b}: {c} 个 ({d}%)' }, legend: { bottom: 0 }, series: [{ type: 'pie', radius: ['42%', '70%'], label: { formatter: '{b}\n{c}个' }, data }] };
}

function buildRiskCategoryOption(rows) {
  const categories = [...new Set(riskRules.map(rule => rule.category))];
  const data = categories.map(category => ({ name: category, value: rows.reduce((sum, row) => sum + row.triggeredRules.filter(rule => rule.category === category).length, 0) })).filter(item => item.value > 0);
  return { color: ['#dc2626', '#f97316', '#2563eb', '#16a34a', '#64748b'], tooltip: { trigger: 'axis' }, grid: { left: 70, right: 24, top: 24, bottom: 38 }, xAxis: { type: 'value', name: '命中次数' }, yAxis: { type: 'category', data: data.map(item => item.name) }, series: [{ type: 'bar', data: data.map(item => item.value), label: { show: true, position: 'right' } }] };
}

function downloadBudgetRiskCsv(rows) {
  const headers = ['需求ID', '名称', '状态', '计划落地', '距落地天数', '人力', '预算状态', '风险等级', '命中规则', '风险说明', '建议操作', '预算缺口w'];
  const lines = [headers.join(',')].concat(rows.map(r => [r.demandNo || r.rr || r.id, r.title, r.status, r.landingDate, Number.isFinite(r.daysToLanding) ? r.daysToLanding : '', r.days, r.budgetStatusLabel, r.riskText, r.triggeredRules.map(rule => rule.name).join('；'), r.riskReason, r.action, r.budgetGap.toFixed(1)].map(v => `"${String(v ?? '').replaceAll('"','""')}"`).join(',')));
  const blob = new Blob(['\ufeff' + lines.join('\n')], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'risk-dashboard.csv'; a.click();
}

function buildExecutorExecutionRows(demands, budget, monthKey) {
  const dayCost = getBudgetDayCost(budget);
  const capacityDays = getMonthlyCapacityDays(budget);
  const rows = new Map();
  demands.filter(d => getDemandMonth(d) === monthKey).forEach(d => {
    const demandPM = d.demandPM || '未填写PM';
    const row = rows.get(demandPM) || { demandPM, demandCount: 0, executionDays: 0, settledDays: 0, acquiredDays: 0, committedDays: 0, unfundedDays: 0, estimatedCost: 0, supportedCost: 0 };
    const days = getExecutionDays(d);
    const cost = days * dayCost;
    const status = getDashboardBudgetStatus(d);
    row.demandCount += 1;
    row.executionDays += days;
    row.estimatedCost += cost;
    if (status === '已结算') { row.settledDays += days; row.supportedCost += cost; }
    else if (status === '已获取') { row.acquiredDays += days; row.supportedCost += cost; }
    else if (status === '已承诺未获取') row.committedDays += days;
    else row.unfundedDays += days;
    rows.set(demandPM, row);
  });
  return [...rows.values()].map(row => {
    const saturation = capacityDays > 0 ? row.executionDays / capacityDays : 0;
    const supportRate = row.estimatedCost > 0 ? row.supportedCost / row.estimatedCost : 1;
    const conclusion = saturation > 1 && supportRate < 1 ? '人力超载且预算不足' : saturation > 1 ? '人力超载' : supportRate < 1 ? '预算不足' : '正常';
    return { ...row, saturation, supportRate, conclusion };
  }).sort((a, b) => b.executionDays - a.executionDays);
}

function buildBudgetSourceExecutionRows(demands, budget) {
  return buildBudgetPoolRows(demands, budget).map(row => ({
    ...row,
    source: row.name,
    budgetAmount: row.amount,
    remaining: row.executionRemaining,
    executionRate: row.executionRate,
    status: row.amount <= 0 && row.executionCost > 0 ? '无预算执行' : row.executionRate > 1 ? '超执行' : row.executionRate >= 0.98 ? '已耗尽' : row.executionRate >= 0.85 ? '接近耗尽' : '正常'
  })).sort((a, b) => b.totalExecutionCost - a.totalExecutionCost);
}

function buildBudgetExecutionDemandRows(demands, budget) {
  return demands.map(d => {
    const executionDays = getExecutionDays(d);
    const executionCost = getDemandExecutionCost(d, budget);
    const budgetAmount = toNumber(d.budget);
    return {
      ...d,
      demandId: d.demandNo || d.rr || d.id,
      demandBA: d.demandBA || '未填写BA',
      demandPM: d.demandPM || '未填写PM',
      budgetSource: matchDemandBudgetPool(d, budget?.pools || [])?.name || unmatchedBudgetPoolName,
      executionStage: getExecutionStage(d),
      month: getDemandMonth(d),
      originalDays: toNumber(d.days),
      finalDays: toNumber(d.finalDays),
      settlementDays: toNumber(d.settlementDays),
      executionDays,
      budgetAmount,
      executionCost,
      budgetStatusLabel: getDashboardBudgetStatus(d),
      budgetInsufficient: executionCost > budgetAmount
    };
  }).sort((a, b) => a.month.localeCompare(b.month) || String(a.demandId).localeCompare(String(b.demandId)));
}

function buildBudgetExecutionSummary(executorRows, sourceRows) {
  const monthlyExecutionDays = executorRows.reduce((s, r) => s + r.executionDays, 0);
  const overloadedExecutors = executorRows.filter(r => r.saturation > 1).length;
  const budgetAmount = sourceRows.reduce((s, r) => s + r.budgetAmount, 0);
  const occupiedCost = sourceRows.reduce((s, r) => s + r.totalExecutionCost, 0);
  const overBudgetSources = sourceRows.filter(r => ['超执行', '无预算执行'].includes(r.status)).length;
  const remaining = sourceRows.reduce((s, r) => s + r.remaining, 0);
  return { monthlyExecutionDays, overloadedExecutors, budgetAmount, occupiedCost, overBudgetSources, remaining };
}

function buildExecutorSaturationOption(rows, budget) {
  const names = rows.map(r => r.demandPM);
  const capacity = getMonthlyCapacityDays(budget);
  const series = [
    ['已结算', 'settledDays', '#166534'], ['已获取预算', 'acquiredDays', '#16a34a'], ['已承诺未获取', 'committedDays', '#f97316'], ['无预算', 'unfundedDays', '#dc2626']
  ];
  return { color: series.map(s => s[2]), tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: value => `${Number(value).toFixed(1)} 人天` }, legend: { top: 0 }, grid: { left: 110, right: 42, top: 42, bottom: 30 }, xAxis: { type: 'value', name: '人天' }, yAxis: { type: 'category', data: names, inverse: true }, series: series.map(([name, key, color], idx) => ({ name, type: 'bar', stack: 'execution', data: rows.map(r => Number(r[key].toFixed(1))), itemStyle: key === 'unfundedDays' ? { color, decal: { symbol: 'line', dashArrayX: [1, 0], dashArrayY: [2, 5], rotation: Math.PI / 4, color: 'rgba(255,255,255,.65)' } } : { color }, markLine: idx === 0 ? { symbol: 'none', lineStyle: { color: '#344054', type: 'dashed' }, label: { formatter: `饱和线 ${capacity} 人天/月` }, data: [{ xAxis: capacity }] } : undefined })) };
}

function buildBudgetSourceExecutionOption(rows) {
  const names = rows.map(r => r.source);
  return { color: ['#166534', '#2563eb', '#f97316', '#dc2626'], tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: params => { const row = rows[params?.[0]?.dataIndex] || {}; return `${row.source || ''}<br/>预算额度：${toNumber(row.budgetAmount).toFixed(1)}w<br/>已执行：${toNumber(row.executedCost).toFixed(1)}w<br/>已排期/执行中：${toNumber(row.scheduledCost).toFixed(1)}w<br/>后续需求：${toNumber(row.laterCost).toFixed(1)}w<br/>剩余额度：${toNumber(row.remaining).toFixed(1)}w<br/>执行率：${Number.isFinite(row.executionRate) ? (row.executionRate * 100).toFixed(1) + '%' : '无预算'}<br/>状态：${row.status || ''}`; } }, legend: { top: 0 }, grid: { left: 110, right: 36, top: 42, bottom: 30 }, xAxis: { type: 'value', name: 'w' }, yAxis: { type: 'category', data: names, inverse: true }, series: [
    { name: '已执行', type: 'bar', stack: 'cost', data: rows.map(r => Number(r.executedCost.toFixed(1))) },
    { name: '已排期/执行中', type: 'bar', stack: 'cost', data: rows.map(r => Number(r.scheduledCost.toFixed(1))) },
    { name: '后续需求', type: 'bar', stack: 'cost', data: rows.map(r => Number(r.laterCost.toFixed(1))) },
    { name: '超执行', type: 'bar', stack: 'cost', data: rows.map(r => Math.max(0, Number((-r.remaining).toFixed(1)))), itemStyle: { color: '#dc2626', decal: { symbol: 'rect', dashArrayX: [2, 2], dashArrayY: [4, 2], rotation: Math.PI / 4, color: 'rgba(255,255,255,.7)' } } }
  ] };
}

function buildBudgetExecutionRateOption(rows) {
  const sorted = [...rows].sort((a, b) => (Number.isFinite(b.executionRate) ? b.executionRate : 999) - (Number.isFinite(a.executionRate) ? a.executionRate : 999));
  const colorOf = status => ['超执行', '无预算执行'].includes(status) ? '#dc2626' : ['接近耗尽', '已耗尽'].includes(status) ? '#f97316' : '#16a34a';
  return { tooltip: { trigger: 'axis', valueFormatter: value => `${value}%` }, grid: { left: 110, right: 40, top: 24, bottom: 30 }, xAxis: { type: 'value', name: '%', max: value => Math.max(120, toNumber(value.max)) }, yAxis: { type: 'category', data: sorted.map(r => r.source), inverse: true }, series: [{ type: 'bar', data: sorted.map(r => ({ value: Number.isFinite(r.executionRate) ? Number((r.executionRate * 100).toFixed(1)) : 120, itemStyle: { color: colorOf(r.status) } })), label: { show: true, position: 'right', formatter: p => `${p.value}%` }, markLine: { symbol: 'none', lineStyle: { color: '#344054', type: 'dashed' }, label: { formatter: '100%耗尽线' }, data: [{ xAxis: 100 }] } }] };
}

function downloadBudgetExecutionCsv(executorRows, sourceRows, demandRows) {
  const quote = v => `"${String(v ?? '').replaceAll('"','""')}"`;
  const sections = [
    ['PM饱和度', ['需求PM','当月需求数','执行人天','饱和度','已结算人天','已获取预算人天','已承诺未获取人天','无预算人天','估算成本w','预算支撑率','结论'], executorRows.map(r => [r.demandPM,r.demandCount,r.executionDays.toFixed(1),(r.saturation*100).toFixed(1)+'%',r.settledDays.toFixed(1),r.acquiredDays.toFixed(1),r.committedDays.toFixed(1),r.unfundedDays.toFixed(1),r.estimatedCost.toFixed(1),(r.supportRate*100).toFixed(1)+'%',r.conclusion])],
    ['预算来源执行', ['预算来源','需求数','预算额度w','已执行w','已排期/执行中w','后续需求w','执行占用合计w','剩余额度w','执行率','无预算需求数','单需求超预算数','状态'], sourceRows.map(r => [r.source,r.demandCount,r.budgetAmount.toFixed(1),r.executedCost.toFixed(1),r.scheduledCost.toFixed(1),r.laterCost.toFixed(1),r.totalExecutionCost.toFixed(1),r.remaining.toFixed(1),Number.isFinite(r.executionRate)?(r.executionRate*100).toFixed(1)+'%':'无预算',r.noBudgetCount,r.overBudgetDemandCount,r.status])],
    ['需求映射明细', ['需求ID','名称','需求BA','需求PM','预算来源','状态','执行阶段','计划落地月份','原预估人天','决算人力','结算人力','预算执行人天','预算金额w','执行成本w','预算状态','预算接口人','是否预算不足'], demandRows.map(r => [r.demandId,r.title,r.demandBA,r.demandPM,r.budgetSource,r.status,r.executionStage,r.month,r.originalDays,r.finalDays,r.settlementDays,r.executionDays,r.budgetAmount,r.executionCost.toFixed(1),r.budgetStatusLabel,r.budgetContact,r.budgetInsufficient?'是':'否'])]
  ];
  const lines = sections.flatMap(([title, headers, rows]) => ['', title, headers.join(','), ...rows.map(row => row.map(quote).join(','))]).slice(1);
  const blob = new Blob(['\ufeff' + lines.join('\n')], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'budget-execution-analysis.csv'; a.click();
}

function formatBudgetMoney(value) {
  return `${toNumber(value).toFixed(1)}w`;
}

function getBudgetPlanMonth(d) {
  if (d.budgetStatus === '已获取' && d.budgetAcquiredDate) return String(d.budgetAcquiredDate).slice(0, 7);
  if (isBudgetCommitted(d.budgetStatus) && d.budgetEta) return String(d.budgetEta).slice(0, 7);
  if (d.landingDate) return String(d.landingDate).slice(0, 7);
  return '未计划';
}

function getBudgetCadenceStatus(d) {
  if (d.budgetStatus === '已获取') return '已获取';
  if (d.budgetStatus === '获取超期') return '获取超期';
  if (d.budgetStatus === '已承诺未获取') return '已承诺未获取';
  return '无预算';
}

function sortBudgetPlanMonth(a, b) {
  if (a === '未计划') return 1;
  if (b === '未计划') return -1;
  return a.localeCompare(b);
}

function buildMonthlyBudgetCadenceRows(demands) {
  const rows = new Map();
  demands.forEach(d => {
    const month = getBudgetPlanMonth(d);
    const row = rows.get(month) || { month, demandCount: 0, budgetAmount: 0, acquired: 0, committed: 0, overdue: 0, noBudget: 0, requesters: new Set(), pms: new Set() };
    const amount = toNumber(d.budget);
    row.demandCount += 1;
    row.budgetAmount += amount;
    if (d.investment) row.requesters.add(d.investment);
    if (d.demandPM) row.pms.add(d.demandPM);
    if (d.budgetStatus === '已获取') row.acquired += amount;
    else if (d.budgetStatus === '获取超期') row.overdue += amount;
    else if (d.budgetStatus === '已承诺未获取') row.committed += amount;
    else row.noBudget += 1;
    rows.set(month, row);
  });
  return [...rows.values()].sort((a, b) => sortBudgetPlanMonth(a.month, b.month)).map(row => ({ ...row, requestersText: [...row.requesters].join('、') || '未填写', pmsText: [...row.pms].join('、') || '未填写' }));
}

function buildBudgetCadenceOption(rows) {
  const months = rows.map(r => r.month);
  return { color: ['#16a34a', '#f97316', '#dc2626'], tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: value => `${value}w` }, legend: { top: 0 }, grid: { left: 48, right: 24, top: 42, bottom: 38 }, xAxis: { type: 'category', data: months }, yAxis: { type: 'value', name: 'w' }, series: [
    { name: '已获取', type: 'bar', stack: 'budget', data: rows.map(r => Number(r.acquired.toFixed(1))) },
    { name: '已承诺未获取', type: 'bar', stack: 'budget', data: rows.map(r => Number(r.committed.toFixed(1))) },
    { name: '获取超期', type: 'bar', stack: 'budget', data: rows.map(r => Number(r.overdue.toFixed(1))), itemStyle: { decal: { symbol: 'line', dashArrayX: [1, 0], dashArrayY: [2, 5], rotation: Math.PI / 4, color: 'rgba(255,255,255,.65)' } } }
  ] };
}

function buildBudgetPlanGroupRows(demands) {
  const rows = new Map();
  demands.forEach(d => {
    const source = d.investment || '未填写需求方';
    const row = rows.get(source) || { source, demandCount: 0, budgetPlan: 0, acquired: 0, pending: 0, noBudgetCount: 0, overdueCount: 0, planMonths: [] };
    const amount = toNumber(d.budget);
    row.demandCount += 1;
    row.budgetPlan += amount;
    if (d.budgetStatus === '已获取') row.acquired += amount;
    else if (hasBudget(d)) row.pending += amount;
    else row.noBudgetCount += 1;
    if (d.budgetStatus === '获取超期') row.overdueCount += 1;
    const month = getBudgetPlanMonth(d);
    if (month !== '未计划') row.planMonths.push(month);
    rows.set(source, row);
  });
  return [...rows.values()].map(row => ({ ...row, latestPlanMonth: row.planMonths.sort(sortBudgetPlanMonth)[0] || '未计划' })).sort((a, b) => b.budgetPlan - a.budgetPlan);
}

function buildBudgetPlanGroupOption(rows) {
  const topRows = rows.slice(0, 10);
  return { color: ['#2563eb', '#16a34a', '#f97316'], tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: value => `${value}w` }, legend: { top: 0 }, grid: { left: 150, right: 34, top: 42, bottom: 30 }, xAxis: { type: 'value', name: 'w' }, yAxis: { type: 'category', data: topRows.map(r => r.source), inverse: true }, series: [
    { name: '预算计划', type: 'bar', data: topRows.map(r => Number(r.budgetPlan.toFixed(1))) },
    { name: '已获取', type: 'bar', data: topRows.map(r => Number(r.acquired.toFixed(1))) },
    { name: '待获取', type: 'bar', data: topRows.map(r => Number(r.pending.toFixed(1))) }
  ] };
}

function buildBudgetPlanDemandRows(demands) {
  return demands.map(d => {
    const planMonth = getBudgetPlanMonth(d);
    const cadenceStatus = getBudgetCadenceStatus(d);
    return {
      ...d,
      demandId: d.demandNo || d.rr || d.id,
      source: d.source || '未填写类型',
      investment: d.investment || '未填写需求方',
      demandBA: d.demandBA || '未填写BA',
      demandPM: d.demandPM || '未填写PM',
      budgetAmount: toNumber(d.budget),
      budgetStatusLabel: d.budgetStatus || '无预算',
      budgetPlanMonth: planMonth,
      cadenceStatus
    };
  }).sort((a, b) => sortBudgetPlanMonth(a.budgetPlanMonth, b.budgetPlanMonth) || String(a.demandId).localeCompare(String(b.demandId)));
}

function downloadBudgetPlanCsv(monthRows, groupRows, demandRows) {
  const quote = v => `"${String(v ?? '').replaceAll('"','""')}"`;
  const sections = [
    ['月度节奏', ['月份','需求数','预算金额w','已获取w','已承诺未获取w','获取超期w','无预算需求数','涉及需求方','涉及PM'], monthRows.map(r => [r.month,r.demandCount,r.budgetAmount.toFixed(1),r.acquired.toFixed(1),r.committed.toFixed(1),r.overdue.toFixed(1),r.noBudget,r.requestersText,r.pmsText])],
    ['需求方汇总', ['需求方','需求数','预算计划w','已获取w','待获取w','无预算需求数','获取超期数','最近计划获取月份'], groupRows.map(r => [r.source,r.demandCount,r.budgetPlan.toFixed(1),r.acquired.toFixed(1),r.pending.toFixed(1),r.noBudgetCount,r.overdueCount,r.latestPlanMonth])],
    ['需求明细', ['需求ID','名称','类型','需求方','需求BA','需求PM','预算金额w','预算状态','预算获取日期','预算承诺日期','计划落地日期','预算接口人','预算计划月份','节奏状态'], demandRows.map(r => [r.demandId,r.title,r.source,r.investment,r.demandBA,r.demandPM,r.budgetAmount,r.budgetStatusLabel,r.budgetAcquiredDate,r.budgetEta,r.landingDate,r.budgetContact,r.budgetPlanMonth,r.cadenceStatus])]
  ];
  const lines = sections.flatMap(([title, headers, rows]) => ['', title, headers.join(','), ...rows.map(row => row.map(quote).join(','))]).slice(1);
  const blob = new Blob(['\ufeff' + lines.join('\n')], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'budget-plan-analysis.csv'; a.click();
}


const initialDemands = [
  { id: 1, title: '制造现场停线预警联动', demandNo: 'RR2026070100001', source: '重要用户', investment: '制造', pain: '产线异常依赖人工电话通知导致响应慢', goal: '打通MES异常与移动端预警', value: '降低停线风险并提升现场响应效率', requester: '制造事业部-刘工', review: '评审通过', status: '开发中', rr: 'RR2026070100001', ir: 'IR-202607-001', priority: 'P0', version: 'V2026.07', landingDate: '2026-07-31', days: 120, analysis: 18, frontend: 25, middle: 35, backend: 42, funded: true, budget: 68, committed: true },
  { id: 2, title: '审计关键操作留痕补齐', demandNo: 'RR2026070100002', source: '产品立项规划', investment: '审计', pain: '部分高风险操作缺少完整审计链路', goal: '补齐权限变更和审批操作留痕', value: '满足审计合规要求并降低问责风险', requester: '审计部-陈工', review: '评审通过', status: '已排期', rr: 'RR2026070100002', ir: 'IR-202607-002', priority: 'P1', version: 'V2026.07', landingDate: '2026-07-31', days: 55, analysis: 10, frontend: 8, middle: 17, backend: 20, funded: true, budget: 32, committed: true },
  { id: 3, title: '核心客户经营报表提速', demandNo: 'RR2026070100003', source: '重要用户', investment: '部门自投', pain: '核心客户月结报表经常超时', goal: '将报表查询耗时降低50%', value: '改善重要客户体验并支撑续约', requester: '客户成功-王工', review: '通过', status: '进行中', rr: 'RR2026070100003', ir: 'IR-202607-003', priority: 'P1', version: 'V2026.07', landingDate: '2026-07-31', days: 75, analysis: 12, frontend: 14, middle: 22, backend: 27, funded: true, budget: 45, committed: true },
  { id: 4, title: '移动端审批字段紧急适配', demandNo: 'RR2026070100005', source: '临时紧急需求', investment: '无预算', pain: '审批字段变更导致移动端展示不完整', goal: '临时适配审批展示和提交字段', value: '保障现场审批连续性', requester: '运营-赵工', review: '建议推进', status: '待启动', rr: 'RR2026070100005', ir: 'IR-202607-005', priority: 'P0', version: 'V2026.07', landingDate: '2026-07-31', days: 38, analysis: 6, frontend: 16, middle: 8, backend: 8, funded: false, budget: 0, committed: false },
  { id: 5, title: '供应商门户订单状态优化', demandNo: 'RR2026070100007', source: '重要用户', investment: '供应', pain: '供应商无法及时看到订单处理节点', goal: '优化订单状态展示和提醒', value: '提升供应协同效率并减少人工问询', requester: '供应链-周工', review: '通过', status: '待启动', rr: 'RR2026070100007', ir: 'IR-202607-007', priority: 'P2', version: 'V2026.08', landingDate: '2026-08-31', days: 82, analysis: 14, frontend: 28, middle: 18, backend: 22, funded: true, budget: 30, committed: false },
  { id: 6, title: '财经预算执行看板', demandNo: 'RR2026070100010', source: '产品立项规划', investment: '财经', pain: '预算执行情况缺少统一视图', goal: '建设预算执行看板和预警规则', value: '提升预算管控效率', requester: '财经-冯工', review: '评审通过', status: '待启动', rr: 'RR2026070100010', ir: 'IR-202607-010', priority: 'P2', version: 'V2026.08', landingDate: '2026-08-31', days: 90, analysis: 16, frontend: 26, middle: 22, backend: 26, funded: true, budget: 35, committed: false },
  { id: 7, title: '采购低频统计报表改版', demandNo: 'RR2026070100012', source: '产品立项规划', investment: '无预算', pain: '低频报表样式与新规范不一致', goal: '重构报表页面并统一样式', value: '体验改善但当前业务收益有限', requester: '采购-韩工', review: '待评审', status: '待启动', rr: 'RR2026070100012', ir: 'IR-202607-012', priority: 'P3', version: 'V2026.09', landingDate: '2026-09-30', days: 72, analysis: 8, frontend: 30, middle: 14, backend: 20, funded: false, budget: 0, committed: false },
  { id: 8, title: '员工关怀活动报名页', demandNo: 'RR2026070100020', source: '产品立项规划', investment: '行政', pain: '活动报名目前通过表格收集', goal: '建设活动报名页面和名单导出', value: '提升行政活动组织效率', requester: '行政-罗工', demandPM: '孙开发', review: '待评审', status: '待启动', rr: 'RR2026070100020', ir: 'IR-202607-020', priority: 'P4', version: 'V2026.09', landingDate: '2026-09-30', days: 28, analysis: 4, frontend: 16, middle: 4, backend: 4, funded: false, budget: 0, budgetStatus: '无预算', committed: false },
  { id: 9, title: '制造设备点检移动化', demandNo: 'RR2026070100021', source: '重要用户', investment: '制造', pain: '设备点检仍依赖纸质记录，异常追溯困难', goal: '上线移动点检和异常闭环流程', value: '提升设备稼动率并降低停机风险', requester: '制造事业部-钱工', demandPM: '王开发', review: '评审通过', status: '已排期', rr: 'RR2026070100021', ir: 'IR-202607-021', priority: '高', version: 'V2026.08', landingDate: '2026-08-15', days: 64, analysis: 10, frontend: 18, middle: 16, backend: 20, budget: 40, budgetStatus: '已承诺未获取', budgetEta: '2026-07-20', budgetContact: '预算接口人A' },
  { id: 10, title: '审计问题整改跟踪台账', demandNo: 'RR2026070100022', source: '产品立项规划', investment: '审计', pain: '整改事项分散在邮件和表格中，状态同步不及时', goal: '统一整改台账、责任人和截止日期提醒', value: '提升审计整改闭环率', requester: '审计部-李工', demandPM: '李开发', review: '通过', status: '开发中', rr: 'RR2026070100022', ir: 'IR-202607-022', priority: '高', version: 'V2026.08', landingDate: '2026-08-20', days: 58, analysis: 8, frontend: 16, middle: 14, backend: 20, budget: 34, budgetStatus: '已获取', budgetAcquiredDate: '2026-06-28', budgetContact: '预算接口人B' },
  { id: 11, title: '供应预测偏差分析', demandNo: 'RR2026070100023', source: '产品立项规划', investment: '供应', pain: '供应预测偏差缺少自动归因，人工分析耗时长', goal: '建立偏差看板和归因明细', value: '减少缺货和库存积压', requester: '供应链-许工', demandPM: '赵开发', review: '评审通过', status: '待评估', rr: 'RR2026070100023', ir: 'IR-202607-023', priority: '一般', version: 'V2026.09', landingDate: '2026-09-15', days: 76, analysis: 12, frontend: 18, middle: 20, backend: 26, budget: 0, budgetStatus: '无预算' },
  { id: 12, title: '财经费用归集自动校验', demandNo: 'RR2026070100024', source: '重要用户', investment: '财经', pain: '费用归集依赖手工检查，错漏风险高', goal: '增加费用规则校验和异常提醒', value: '提升财务关账质量', requester: '财经-宋工', demandPM: '钱开发', review: '评审通过', status: '已上线', rr: 'RR2026070100024', ir: 'IR-202607-024', priority: '高', version: 'V2026.07', landingDate: '2026-07-25', days: 44, analysis: 6, frontend: 10, middle: 12, backend: 16, budget: 30, budgetStatus: '已获取', budgetAcquiredDate: '2026-06-18', budgetContact: '预算接口人C' },
  { id: 13, title: '采购合同到期预警', demandNo: 'RR2026070100025', source: '产品立项规划', investment: '采购', pain: '合同到期依赖人工维护，续签节点容易遗漏', goal: '建立合同到期预警和续签任务', value: '降低采购履约风险', requester: '采购-黄工', demandPM: '孙开发', review: '通过', status: '已排期', rr: 'RR2026070100025', ir: 'IR-202607-025', priority: '高', version: 'V2026.08', landingDate: '2026-08-31', days: 36, analysis: 6, frontend: 10, middle: 8, backend: 12, budget: 18, budgetStatus: '获取超期', budgetEta: '2026-06-30', budgetContact: '预算接口人D' },
  { id: 14, title: '行政会议室资源优化', demandNo: 'RR2026070100026', source: '产品立项规划', investment: '行政', pain: '会议室使用冲突多，空闲资源不可视', goal: '优化会议室预约和冲突提醒', value: '提升办公资源使用效率', requester: '行政-谢工', demandPM: '李开发', review: '待评审', status: '待评估', rr: 'RR2026070100026', ir: 'IR-202607-026', priority: '一般', version: 'V2026.10', landingDate: '2026-10-10', days: 30, analysis: 4, frontend: 12, middle: 6, backend: 8, budget: 0, budgetStatus: '无预算' },
  { id: 15, title: '部门基线流程配置中心', demandNo: 'RR2026070100027', source: '产品立项规划', investment: '部门基线', pain: '多团队流程配置分散，变更无法统一审计', goal: '建设流程配置中心和变更记录', value: '提升跨团队配置治理能力', requester: '流程平台-周工', demandPM: '王开发', review: '评审通过', status: '开发中', rr: 'RR2026070100027', ir: 'IR-202607-027', priority: '紧急', version: 'V2026.08', landingDate: '2026-08-05', days: 98, analysis: 14, frontend: 24, middle: 28, backend: 32, budget: 60, budgetStatus: '已承诺未获取', budgetEta: '2026-07-18', budgetContact: '预算接口人E' },
  { id: 16, title: '部门非基线报表权限清理', demandNo: 'RR2026070100028', source: '产品立项规划', investment: '部门非基线', pain: '历史报表权限长期未清理，存在越权风险', goal: '梳理报表权限并提供批量清理工具', value: '降低内部权限风险', requester: '数据平台-郑工', demandPM: '赵开发', review: '通过', status: '待评估', rr: 'RR2026070100028', ir: 'IR-202607-028', priority: '一般', version: 'V2026.10', landingDate: '2026-10-20', days: 42, analysis: 8, frontend: 10, middle: 10, backend: 14, budget: 20, budgetStatus: '已承诺未获取', budgetEta: '2026-08-01', budgetContact: '预算接口人F' },
  { id: 17, title: '制造质量缺陷闭环追踪', demandNo: 'RR2026070100029', source: '重要用户', investment: '制造', pain: '质量缺陷处理跨系统流转，责任和进度不清晰', goal: '统一缺陷闭环追踪和升级机制', value: '缩短质量问题处理周期', requester: '质量部-吴工', demandPM: '钱开发', review: '评审通过', status: '已验收', rr: 'RR2026070100029', ir: 'IR-202607-029', priority: '高', version: 'V2026.07', landingDate: '2026-07-10', days: 52, finalDays: 50, settlementDays: 49, analysis: 8, frontend: 12, middle: 14, backend: 18, budget: 38, budgetStatus: '已获取', budgetAcquiredDate: '2026-06-05', budgetContact: '预算接口人A' },
  { id: 18, title: '审计取证材料批量下载', demandNo: 'RR2026070100030', source: '临时紧急需求', investment: '审计', pain: '外部审计要求短期批量提供取证材料', goal: '支持按任务批量打包和下载取证材料', value: '保障审计响应时效', requester: '审计部-马工', demandPM: '孙开发', review: '建议推进', status: '已排期', rr: 'RR2026070100030', ir: 'IR-202607-030', priority: '紧急', version: 'V2026.08', landingDate: '2026-08-08', days: 34, analysis: 6, frontend: 8, middle: 8, backend: 12, budget: 16, budgetStatus: '获取超期', budgetEta: '2026-06-25', budgetContact: '预算接口人B' },
  { id: 19, title: '供应交期承诺看板', demandNo: 'RR2026070100031', source: '重要用户', investment: '供应', pain: '供应商交期承诺分散，延期无法提前识别', goal: '展示交期承诺、变更记录和延期风险', value: '提升供应交付稳定性', requester: '供应链-曹工', demandPM: '李开发', review: '通过', status: '开发中', rr: 'RR2026070100031', ir: 'IR-202607-031', priority: '高', version: 'V2026.09', landingDate: '2026-09-05', days: 66, analysis: 10, frontend: 18, middle: 16, backend: 22, budget: 36, budgetStatus: '已承诺未获取', budgetEta: '2026-07-28', budgetContact: '预算接口人C' },
  { id: 20, title: '财经预算冻结校验', demandNo: 'RR2026070100032', source: '临时紧急需求', investment: '财经', pain: '预算冻结期间仍可能提交占用申请', goal: '增加冻结状态校验和阻断提示', value: '降低预算管控风险', requester: '财经-蒋工', demandPM: '王开发', review: '建议推进', status: '已排期', rr: 'RR2026070100032', ir: 'IR-202607-032', priority: '紧急', version: 'V2026.08', landingDate: '2026-08-12', days: 26, analysis: 4, frontend: 6, middle: 6, backend: 10, budget: 12, budgetStatus: '已获取', budgetAcquiredDate: '2026-07-01', budgetContact: '预算接口人D' },
  { id: 21, title: '采购询价比价记录沉淀', demandNo: 'RR2026070100033', source: '产品立项规划', investment: '采购', pain: '询价比价记录依赖线下附件，复盘困难', goal: '沉淀询价过程和比价结果', value: '提升采购透明度', requester: '采购-陆工', demandPM: '赵开发', review: '待评审', status: '待评估', rr: 'RR2026070100033', ir: 'IR-202607-033', priority: '一般', version: 'V2026.10', landingDate: '2026-10-31', days: 48, analysis: 8, frontend: 12, middle: 10, backend: 18, budget: 0, budgetStatus: '无预算' },
  { id: 22, title: '行政资产盘点扫码', demandNo: 'RR2026070100034', source: '重要用户', investment: '行政', pain: '固定资产盘点人工登记效率低', goal: '支持扫码盘点、差异记录和导出', value: '提升资产盘点效率', requester: '行政-高工', demandPM: '钱开发', review: '通过', status: '已上线', rr: 'RR2026070100034', ir: 'IR-202607-034', priority: '高', version: 'V2026.08', landingDate: '2026-08-25', days: 40, analysis: 6, frontend: 14, middle: 8, backend: 12, budget: 24, budgetStatus: '已获取', budgetAcquiredDate: '2026-07-12', budgetContact: '预算接口人E' },
  { id: 23, title: '部门基线统一消息订阅', demandNo: 'RR2026070100035', source: '产品立项规划', investment: '部门基线', pain: '各系统消息订阅能力重复建设，用户配置分散', goal: '建设统一消息订阅配置能力', value: '减少重复开发并提升用户体验', requester: '平台产品-冯工', demandPM: '孙开发', review: '评审通过', status: '开发中', rr: 'RR2026070100035', ir: 'IR-202607-035', priority: '高', version: 'V2026.09', landingDate: '2026-09-20', days: 88, analysis: 12, frontend: 24, middle: 24, backend: 28, budget: 50, budgetStatus: '已承诺未获取', budgetEta: '2026-08-05', budgetContact: '预算接口人F' },
  { id: 24, title: '部门非基线数据导出审计', demandNo: 'RR2026070100036', source: '产品立项规划', investment: '部门非基线', pain: '数据导出缺少统一审计记录', goal: '补齐导出审批、留痕和追溯能力', value: '降低数据外泄风险', requester: '数据安全-唐工', demandPM: '李开发', review: '评审通过', status: '已排期', rr: 'RR2026070100036', ir: 'IR-202607-036', priority: '高', version: 'V2026.09', landingDate: '2026-09-18', days: 62, analysis: 10, frontend: 12, middle: 18, backend: 22, budget: 32, budgetStatus: '获取超期', budgetEta: '2026-07-10', budgetContact: '预算接口人G' },
  { id: 25, title: '制造工艺变更审批提速', demandNo: 'RR2026070100037', source: '重要用户', investment: '制造', pain: '工艺变更审批节点多，催办依赖人工', goal: '优化审批链路并增加自动催办', value: '缩短工艺变更生效周期', requester: '工艺部-何工', demandPM: '王开发', review: '通过', status: '已排期', rr: 'RR2026070100037', ir: 'IR-202607-037', priority: '高', version: 'V2026.08', landingDate: '2026-08-28', days: 54, analysis: 8, frontend: 14, middle: 14, backend: 18, budget: 28, budgetStatus: '已承诺未获取', budgetEta: '2026-07-22', budgetContact: '预算接口人A' },
  { id: 26, title: '供应商绩效月报自动生成', demandNo: 'RR2026070100038', source: '产品立项规划', investment: '供应', pain: '供应商绩效月报人工汇总耗时', goal: '自动生成绩效月报并支持导出', value: '提升供应管理效率', requester: '供应链-邓工', demandPM: '赵开发', review: '通过', status: '待评估', rr: 'RR2026070100038', ir: 'IR-202607-038', priority: '一般', version: 'V2026.10', landingDate: '2026-10-15', days: 46, analysis: 8, frontend: 12, middle: 10, backend: 16, budget: 22, budgetStatus: '已承诺未获取', budgetEta: '2026-08-15', budgetContact: '预算接口人C' },
  { id: 27, title: '财经科目映射维护优化', demandNo: 'RR2026070100039', source: '产品立项规划', investment: '财经', pain: '科目映射维护缺少批量校验', goal: '支持批量导入校验和变更审批', value: '提升财务主数据准确性', requester: '财经-叶工', demandPM: '钱开发', review: '评审通过', status: '开发中', rr: 'RR2026070100039', ir: 'IR-202607-039', priority: '高', version: 'V2026.09', landingDate: '2026-09-12', days: 70, analysis: 12, frontend: 16, middle: 18, backend: 24, budget: 44, budgetStatus: '已获取', budgetAcquiredDate: '2026-07-08', budgetContact: '预算接口人D' },
  { id: 28, title: '采购黑名单规则预警', demandNo: 'RR2026070100040', source: '临时紧急需求', investment: '采购', pain: '高风险供应商识别依赖人工经验', goal: '增加黑名单规则预警和拦截提示', value: '降低采购合规风险', requester: '采购-沈工', demandPM: '孙开发', review: '建议推进', status: '已排期', rr: 'RR2026070100040', ir: 'IR-202607-040', priority: '紧急', version: 'V2026.08', landingDate: '2026-08-18', days: 32, analysis: 6, frontend: 8, middle: 8, backend: 10, budget: 0, budgetStatus: '无预算' }
];

function createEmptyDemand() {
  return {
    title: '', demandNo: '', source: '产品立项规划', investment: '部门基线（OBP/存量/差评等）', pain: '', goal: '', value: '', acceptanceCriteria: '', requester: '', demandBA: '', demandPM: '', review: '待评审', status: '待评估',
    rr: '', ir: '', priority: '高', version: 'V2026.08', landingDate: '2026-08-31', days: 30,
    analysis: 5, frontend: 10, middle: 8, backend: 7, workloadMode: 'total', finalDays: 0, settlementDays: 0, funded: true, budget: 0, budgetStatus: '已承诺未获取', budgetContact: '', budgetEta: '', budgetAcquiredDate: '', committed: true
  };
}

const priorityScore = { 紧急: 100, 高: 70, 一般: 35 };
const sourceScore = { 临时紧急需求: 25, 重要用户: 20, DFx需求: 16, 产品立项规划: 12, '存量运营维护/差评/零星需求': 10 };
const reviewScore = { 通过: 20, 评审通过: 20, 建议推进: 14, 待评审: 0, 不通过: -40 };
const statusScore = { 待评估: 4, 已排期: 12, 开发中: 18, 已上线: 16, 已验收: 20 };
const valueKeywords = ['合规', '监管', '审计', '重要客户', '降本', '增效', '风险', '稳定', '体验'];

function scoreDemand(d) {
  let score = priorityScore[d.priority] ?? 35;
  score += sourceScore[d.source] ?? 0;
  score += reviewScore[d.review] ?? 0;
  score += statusScore[d.status] ?? 0;
  if (hasBudget(d)) score += 18;
  if (d.committed) score += 15;
  const valueText = `${d.value} ${d.pain} ${d.goal}`;
  valueKeywords.forEach(k => { if (valueText.includes(k)) score += 10; });
  if (toNumber(d.days) <= 30) score += 4;
  if (toNumber(d.days) >= 100) score -= 10;
  return score;
}

function analyze(demands, personnel, budget) {
  const costRows = personnel.filter(p => toNumber(p.dailyCost) > 0);
  const costCount = costRows.length || 1;
  const tmDailyCost = costRows.reduce((sum, p) => sum + toNumber(p.dailyCost), 0) / costCount || getBudgetDayCost(budget);
  const totalDays = demands.reduce((s, d) => s + toNumber(d.days), 0);
  const budgetBalance = budget.annualBudget - budget.consumedCost;
  return budget.scenarios.map(s => {
    const availableBudget = budgetBalance + toNumber(s.addedBudget);
    const nextMonthBudget = Math.max(0, availableBudget);
    const supportedDays = tmDailyCost > 0 ? nextMonthBudget / tmDailyCost : 0;
    const ordered = [...demands].map(d => ({ ...d, score: scoreDemand(d) })).sort((a, b) => b.score - a.score);
    const retained = [];
    const deferred = [];
    const cut = [];
    let used = 0;
    ordered.forEach(d => {
      const hardKeep = d.priority === '紧急' || d.committed || (hasBudget(d) && ['开发中', '已上线', '已验收'].includes(d.status));
      if (used + toNumber(d.days) <= supportedDays || hardKeep) {
        retained.push({ ...d, decision: '保留', reason: reasonOf(d, '保留') });
        used += toNumber(d.days);
      } else if (d.score >= 70 || d.priority === '高') {
        deferred.push({ ...d, decision: '延期', reason: reasonOf(d, '延期') });
      } else {
        cut.push({ ...d, decision: '削减', reason: reasonOf(d, '削减') });
      }
    });
    return {
      name: s.name,
      description: s.description,
      addedBudget: toNumber(s.addedBudget),
      availableBudget,
      nextMonthBudget,
      supportedDays,
      supportedMonths: supportedDays / budget.monthlyWorkdays,
      totalDays,
      reductionNeeded: Math.max(0, totalDays - supportedDays),
      retained,
      deferred,
      cut
    };
  });
}

function reasonOf(d, decision) {
  const parts = [];
  parts.push(`优先级${d.priority}`);
  if (['临时紧急需求', '重要用户'].includes(d.source)) parts.push(d.source);
  parts.push(hasBudget(d) ? '有预算/投资来源' : '未明确预算');
  if (d.review) parts.push(`评审:${d.review}`);
  if (d.status) parts.push(`状态:${d.status}`);
  if (toNumber(d.days) >= 80 && decision !== '保留') parts.push('工作量较大');
  return parts.join('；');
}

function groupSum(items, field) {
  const map = new Map();
  items.forEach(i => map.set(i[field] || '未填写', (map.get(i[field] || '未填写') || 0) + toNumber(i.days)));
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

const defaultPersonnel = Array.from({ length: 40 }, (_, idx) => {
  const isTm = idx < 35;
  const no = String(isTm ? idx + 1 : idx - 34).padStart(3, '0');
  const positions = ['设计', '前端', '后端', '数据', 'UX', '测试', 'PM'];
  const locations = ['深圳', '上海', '北京', '杭州'];
  const owners = ['交付一组', '交付二组', '平台组', '数据组', '体验组'];
  return {
    id: idx + 1,
    name: `${isTm ? 'TM' : 'OD'}人员${no}`,
    employeeNo: `${isTm ? 'TM' : 'OD'}-${no}`,
    owner: owners[idx % owners.length],
    position: positions[idx % positions.length],
    location: locations[idx % locations.length],
    supplier: isTm ? '内部' : `供应商${String.fromCharCode(65 + (idx % 3))}`,
    entryDate: `2025-${String((idx % 12) + 1).padStart(2, '0')}-01`,
    dailyCost: 1481.48,
    monthlyDays: 22.5
  };
});

const defaultBudget = { annualBudget: 683, consumedCost: 712, dayCost: 0.12, monthlyWorkdays: 22.5, annualWorkdays: 270, pools: [
  { id: 'pool-baseline', name: '部门基线（OBP/存量/差评等）', ownerDept: '部门基线（OBP/存量/差评等）', type: 'department-baseline', month: '', amount: 683, description: '部门基线、OBP、存量运营和差评类预算池' },
  ...demandPartyOptions.filter(name => name !== '部门基线（OBP/存量/差评等）').map((name, idx) => ({ id: `pool-demand-${idx + 1}`, name: `${name}预算池`, ownerDept: name, type: 'demand-side', month: '', amount: 0, description: '需求方提供预算，按需维护金额' }))
], scenarios: [
  { name: '极限低预算', addedBudget: 40, description: '仅获得少量追加预算，基本只能覆盖部分超支' },
  { name: '保守预算', addedBudget: 80, description: '获得低位预算假设' },
  { name: '中性预算', addedBudget: 160, description: '获得中位预算假设' },
  { name: '积极预算', addedBudget: 260, description: '获得高位预算假设' }
]};

function loadStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeBudget(rawBudget) {
  const merged = { ...defaultBudget, ...(rawBudget || {}) };
  const rawPools = Array.isArray(rawBudget?.pools) && rawBudget.pools.length ? rawBudget.pools : defaultBudget.pools.map(pool => pool.id === 'pool-baseline' ? { ...pool, amount: toNumber(merged.annualBudget) || pool.amount } : pool);
  return {
    ...merged,
    annualBudget: toNumber(merged.annualBudget),
    consumedCost: toNumber(merged.consumedCost),
    dayCost: toNumber(merged.dayCost || merged.costPerDay || defaultBudget.dayCost),
    monthlyWorkdays: toNumber(merged.monthlyWorkdays || defaultBudget.monthlyWorkdays),
    annualWorkdays: toNumber(merged.annualWorkdays || defaultBudget.annualWorkdays),
    scenarios: Array.isArray(merged.scenarios) ? merged.scenarios.map(item => ({ ...item, addedBudget: toNumber(item.addedBudget) })) : defaultBudget.scenarios,
    pools: rawPools.map((pool, idx) => ({
      id: pool.id || `pool-${Date.now()}-${idx}`,
      name: pool.name || `预算池${idx + 1}`,
      ownerDept: pool.ownerDept || pool.owner || '',
      type: budgetPoolTypeLabels[pool.type] ? pool.type : 'other',
      month: pool.month || '',
      amount: Math.max(0, toNumber(pool.amount ?? pool.budget ?? 0)),
      description: pool.description || ''
    }))
  };
}

const appPageIds = ['demands', 'submit', 'personnel', 'budgetManage', 'budget', 'budgetRisk', 'budgetExecution', 'manual'];
const getInitialPage = () => {
  const hashPage = window.location.hash.replace(/^#\/?/, '');
  const pathPage = window.location.pathname.replace(/^\//, '').split('/')[0];
  return appPageIds.includes(hashPage) ? hashPage : appPageIds.includes(pathPage) ? pathPage : 'demands';
};

function App() {
  const [page, setPageState] = useState(getInitialPage);
  const setPage = nextPage => {
    setPageState(nextPage);
    if (appPageIds.includes(nextPage)) window.history.replaceState(null, '', `/#${nextPage}`);
  };
  const [demands, setDemands] = useState(() => loadStored('wfp.demands', initialDemands).map(d => normalizeDemand({ ...d, landingDate: d.landingDate || '' })));
  const [personnel, setPersonnel] = useState(() => loadStored('wfp.personnel', defaultPersonnel));
  const [budget, setBudget] = useState(() => normalizeBudget(loadStored('wfp.budget', defaultBudget)));
  React.useEffect(() => localStorage.setItem('wfp.demands', JSON.stringify(demands)), [demands]);
  React.useEffect(() => localStorage.setItem('wfp.personnel', JSON.stringify(personnel)), [personnel]);
  React.useEffect(() => localStorage.setItem('wfp.budget', JSON.stringify(budget)), [budget]);
  React.useEffect(() => {
    const syncPageFromHash = () => {
      const hashPage = window.location.hash.replace(/^#\/?/, '');
      if (appPageIds.includes(hashPage)) setPageState(hashPage);
    };
    window.addEventListener('hashchange', syncPageFromHash);
    return () => window.removeEventListener('hashchange', syncPageFromHash);
  }, []);
  const totalDays = demands.reduce((s, d) => s + toNumber(d.days), 0);
  const unfundedDays = demands.filter(d => !hasBudget(d)).reduce((s, d) => s + toNumber(d.days), 0);
  const openDemand = id => { setPage('demands'); setTimeout(() => window.dispatchEvent(new CustomEvent('wfp.openDemand', { detail: id })), 0); };
  const openDemandFilter = (key, value) => { setPage('demands'); setTimeout(() => window.dispatchEvent(new CustomEvent('wfp.filterDemands', { detail: { key, value } })), 0); };
  const openDemandIds = (ids, label) => { setPage('demands'); setTimeout(() => window.dispatchEvent(new CustomEvent('wfp.filterDemandIds', { detail: { ids, label } })), 0); };
  const openBudgetRiskIds = (ids, label) => { setPage('budget'); setTimeout(() => window.dispatchEvent(new CustomEvent('wfp.filterRiskDemandIds', { detail: { ids, label } })), 0); };
  const nav = [
    ['demands', FileText, '需求池'], ['submit', BriefcaseBusiness, '提交需求'], ['personnel', Users, '人员管理'], ['budgetManage', Settings, '预算管理'], ['budget', PieChart, '预算与风险分析'], ['manual', BookOpen, '操作手册']
  ];
  return <div className="app">
    <aside><div className="brand"><BarChart3 size={28}/><div><b>需求及人力规划</b><span>Workforce Planning</span></div></div>{nav.map(([id, Icon, label]) => <button key={id} className={page===id?'active':''} onClick={()=>setPage(id)}><Icon size={18}/>{label}</button>)}</aside>
    <main>
      {page === 'demands' && <DemandPool demands={demands} setDemands={setDemands} totalDays={totalDays} unfundedDays={unfundedDays}/>}
      {page === 'submit' && <DemandSubmit demands={demands} setDemands={setDemands} goPool={()=>setPage('demands')}/>}
      {page === 'personnel' && <Personnel personnel={personnel} setPersonnel={setPersonnel} demands={demands} budget={budget} openDemand={openDemand}/>}
      {page === 'budgetManage' && <BudgetManagementPage demands={demands} budget={budget} setBudget={setBudget} openDemandIds={openDemandIds}/>}
      {['budget', 'budgetRisk', 'budgetExecution'].includes(page) && <BudgetRiskAnalysisPage demands={demands} budget={budget} setBudget={setBudget} openDemand={openDemand} openDemandFilter={openDemandFilter} openDemandIds={openDemandIds}/>}
      {page === 'manual' && <Manual/>}
      <button className="reset-floating" onClick={()=>{ if (confirm('确认恢复初始示例数据？当前导入和修改的数据会被清空。')) { localStorage.removeItem('wfp.demands'); localStorage.removeItem('wfp.personnel'); localStorage.removeItem('wfp.budget'); location.reload(); }}}>恢复初始数据</button>
    </main>
  </div>;
}

function Header({title, desc}) { return <div className="page-header"><h1>{title}</h1><p>{desc}</p></div>; }
function Kpi({label, value, sub, tone}) { return <div className="kpi"><span>{label}</span><b className={tone||''}>{value}</b>{sub && <small>{sub}</small>}</div>; }

function Dashboard({demands, totalDays, compact = false}) {
  const missingCoreFields = demands.filter(d => !d.demandNo || !d.title || !d.requester || !d.landingDate || !toNumber(d.days)).length;
  const budgetedCount = demands.filter(d => hasBudget(d)).length;
  return <section className={compact ? 'dashboard-compact' : ''}><div className="kpi-grid four"><Kpi label="需求总数" value={`${demands.length} 个`}/><Kpi label="总预估人天" value={`${totalDays} 人天`}/><Kpi label="有预算状态需求数" value={`${budgetedCount} 个`}/><Kpi label="数据缺失数量" value={`${missingCoreFields} 个`} tone={missingCoreFields>0?'danger':'ok'} sub="单号/名称/提出人/落地日期/人天"/></div></section>;
}

const demandColumnLabels = {
  title: '需求', demandNo: '需求单号', requester: '提出人', demandBA: '需求BA', demandPM: '需求PM', source: '类型', acceptanceCriteria: '验收标准', investment: '需求方', priority: '优先级', landingDate: '计划落地日期', budgetStatus: '预算状态', budgetAcquiredDate: '预算获取日期', budgetContact: '预算接口人', budgetEta: '预算承诺日期', days: '预估人天', finalDays: '决算人力', version: '版本', status: '需求状态', settlementDays: '结算人力'
};

function DemandPool({demands, setDemands, totalDays, unfundedDays}) {
  const [filter, setFilter] = useState('全部');
  const [keyword, setKeyword] = useState('');
  const [columnFilters, setColumnFilters] = useState({});
  const [monthStart, setMonthStart] = useState('');
  const [monthEnd, setMonthEnd] = useState('');
  const [dateSort, setDateSort] = useState({ key: '', direction: 'asc' });
  const [filteredIds, setFilteredIds] = useState(null);
  const [filteredIdsLabel, setFilteredIdsLabel] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [importMsg, setImportMsg] = useState('');
  const [importDraft, setImportDraft] = useState(null);
  const defaultColumnKeys = ['title','demandNo','requester','demandBA','demandPM','source','acceptanceCriteria','investment','priority','landingDate','budgetStatus','budgetAcquiredDate','budgetContact','budgetEta','days','finalDays','version','status','settlementDays'];
  const [columnOrder, setColumnOrder] = useState(() => {
    const stored = loadStored('wfp.demandColumnOrder', defaultColumnKeys);
    return [...stored.filter(key => defaultColumnKeys.includes(key)), ...defaultColumnKeys.filter(key => !stored.includes(key))];
  });
  const [draggingColumn, setDraggingColumn] = useState('');
  const [dropTarget, setDropTarget] = useState(null);
  const tableScrollRef = useRef(null);
  const topScrollRef = useRef(null);
  const tableRef = useRef(null);
  const [scrollProxyStyle, setScrollProxyStyle] = useState({ display: 'none' });
  const [scrollThumbStyle, setScrollThumbStyle] = useState({ width: 0, left: 0 });
  const scrollDragRef = useRef(null);
  const updateFloatingScrollbar = () => {
    const tableCard = tableScrollRef.current;
    const table = tableRef.current;
    if (!tableCard || !table || table.scrollWidth <= tableCard.clientWidth) {
      setScrollProxyStyle({ display: 'none' });
      return;
    }
    const rect = tableCard.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const visibleTop = Math.max(rect.top, 0);
    const visibleBottom = Math.min(rect.bottom, viewportHeight);
    if (visibleBottom - visibleTop < 48) {
      setScrollProxyStyle({ display: 'none' });
      return;
    }
    const thumbWidth = Math.max(44, rect.width * (tableCard.clientWidth / table.scrollWidth));
    const travel = Math.max(1, rect.width - thumbWidth);
    const maxScroll = Math.max(1, table.scrollWidth - tableCard.clientWidth);
    setScrollProxyStyle({ display: 'block', left: `${rect.left}px`, width: `${rect.width}px`, bottom: `${Math.max(12, viewportHeight - visibleBottom + 8)}px` });
    setScrollThumbStyle({ width: `${thumbWidth}px`, left: `${(tableCard.scrollLeft / maxScroll) * travel}px` });
  };
  const startScrollDrag = event => {
    const tableCard = tableScrollRef.current;
    const track = topScrollRef.current;
    if (!tableCard || !track) return;
    const trackRect = track.getBoundingClientRect();
    const thumbWidth = parseFloat(scrollThumbStyle.width) || 44;
    const maxScroll = Math.max(1, tableCard.scrollWidth - tableCard.clientWidth);
    const travel = Math.max(1, trackRect.width - thumbWidth);
    scrollDragRef.current = { x: event.clientX, scrollLeft: tableCard.scrollLeft, maxScroll, travel };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };
  const moveScrollDrag = event => {
    if (!scrollDragRef.current || !tableScrollRef.current) return;
    const { x, scrollLeft, maxScroll, travel } = scrollDragRef.current;
    tableScrollRef.current.scrollLeft = scrollLeft + ((event.clientX - x) / travel) * maxScroll;
    updateFloatingScrollbar();
  };
  const endScrollDrag = event => {
    scrollDragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };
  React.useEffect(() => localStorage.setItem('wfp.demandColumnOrder', JSON.stringify(columnOrder)), [columnOrder]);
  const filtered = filter === '全部' ? demands : demands.filter(d => d.priority === filter || d.investment === filter || d.source === filter);
  const monthOptions = useMemo(() => buildMonthOptions(demands), [demands]);
  const monthInRange = d => {
    const month = d.landingDate ? String(d.landingDate).slice(0, 7) : '';
    if (!month) return !monthStart && !monthEnd;
    return (!monthStart || month >= monthStart) && (!monthEnd || month <= monthEnd);
  };
  const monthFiltered = filtered.filter(monthInRange);
  const query = keyword.trim().toLowerCase();
  const fullTextFields = ['title','demandNo','source','acceptanceCriteria','investment','requester','version','landingDate','budgetContact','budgetEta','budgetStatus','rr','ir','priority','review','status'];
  const cellText = (d, key) => key === 'investment' ? (d.investment || '未填写需求方') : String(d[key] ?? '');
  const list = monthFiltered.filter(d => {
    const matchesIds = !filteredIds || filteredIds.includes(d.id);
    const matchesKeyword = !query || fullTextFields.some(k => String(d[k] ?? '').toLowerCase().includes(query));
    const matchesColumns = Object.entries(columnFilters).every(([key, value]) => !value || cellText(d, key).toLowerCase().includes(value.toLowerCase()));
    return matchesIds && matchesKeyword && matchesColumns;
  }).sort((a, b) => {
    if (!dateSort.key) return 0;
    return compareSortValues(cellText(a, dateSort.key), cellText(b, dateSort.key)) * (dateSort.direction === 'asc' ? 1 : -1);
  });
  const textWidth = value => Math.max(2, [...String(value ?? '')].reduce((sum, ch) => sum + (/[^\x00-\xff]/.test(ch) ? 2 : 1), 0));
  const maxAutoColumnWidth = 24;
  const columnWidth = key => {
    if (key === 'title') return null;
    if (key === 'acceptanceCriteria') return 36;
    const label = demandColumnLabels[key] || '';
    const values = list.map(d => cellText(d, key));
    const contentWidth = Math.max(textWidth(label), textWidth(columnFilters[key] || ''), ...values.map(textWidth));
    const controlPadding = ['source', 'budgetStatus', 'priority', 'status'].includes(key) ? 4 : 2;
    return Math.min(maxAutoColumnWidth, contentWidth + controlPadding);
  };
  const fitStyle = key => key === 'title' ? undefined : key === 'acceptanceCriteria' ? { width: '36ch', minWidth: '36ch', maxWidth: '48ch' } : { width: `${columnWidth(key)}ch`, minWidth: `${columnWidth(key)}ch` };
  const setColumnFilter = (key, value) => setColumnFilters(filters => ({ ...filters, [key]: value }));
  const clearAllFilters = () => {
    setKeyword('');
    setFilter('全部');
    setColumnFilters({});
    setMonthStart('');
    setMonthEnd('');
    setDateSort({ key: '', direction: 'asc' });
    setFilteredIds(null);
    setFilteredIdsLabel('');
    setExpandedId(null);
  };
  const toggleDateSort = key => setDateSort(current => current.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' });
  const updateDemand = (id, key, value) => {
    if ((key === 'rr' || key === 'demandNo') && !isValidRrInput(value)) return;
    setDemands(ds => {
      if (key === 'demandNo' || key === 'rr') {
        const demandNo = formatRr(value);
        if (isValidRr(demandNo) && ds.some(d => d.id !== id && formatRr(d.demandNo || d.rr) === demandNo)) {
          alert(`需求单号不能重复：${demandNo}`);
          return ds;
        }
      }
      return ds.map(d => d.id === id ? normalizeDemand({ ...d, [key]: value }) : d);
    });
  };
  const deleteDemand = id => {
    if (confirm('确认删除该需求？')) {
      setDemands(ds => ds.filter(x => x.id !== id));
      setExpandedId(current => current === id ? null : current);
    }
  };
  React.useEffect(() => {
    const handler = event => {
      const id = event.detail;
      setKeyword('');
      setFilter('全部');
      setColumnFilters({});
      setFilteredIds(null);
      setFilteredIdsLabel('');
      setExpandedId(id);
      setTimeout(() => document.getElementById(`demand-row-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    };
    window.addEventListener('wfp.openDemand', handler);
    return () => window.removeEventListener('wfp.openDemand', handler);
  }, []);
  React.useEffect(() => {
    const handler = event => {
      const { key, value } = event.detail || {};
      if (!key) return;
      setKeyword('');
      setFilter('全部');
      setExpandedId(null);
      setFilteredIds(null);
      setFilteredIdsLabel('');
      setColumnFilters({ [key]: value || '' });
      setTimeout(() => document.querySelector('.table-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    };
    window.addEventListener('wfp.filterDemands', handler);
    return () => window.removeEventListener('wfp.filterDemands', handler);
  }, []);
  React.useEffect(() => {
    const handler = event => {
      const { ids, label } = event.detail || {};
      setKeyword('');
      setFilter('全部');
      setColumnFilters({});
      setExpandedId(null);
      setFilteredIds(Array.isArray(ids) ? ids : []);
      setFilteredIdsLabel(label || '已按来源筛选');
      setTimeout(() => document.querySelector('.table-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    };
    window.addEventListener('wfp.filterDemandIds', handler);
    return () => window.removeEventListener('wfp.filterDemandIds', handler);
  }, []);
  const onImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length < 2) throw new Error('CSV至少需要表头和一行数据');
      const headers = rows[0].map(h => h.trim()).filter(Boolean);
      const previewRows = rows.slice(1).filter(row => row.some(cell => String(cell ?? '').trim() !== '')).slice(0, 5);
      setImportDraft({ text, headers, mapping: guessDemandImportMapping(headers), previewRows });
      setImportMsg('已读取文件，请确认字段映射后导入');
    } catch (err) {
      setImportMsg(`导入失败：${err.message}`);
    } finally {
      event.target.value = '';
    }
  };
  const moveColumn = (fromKey, toKey, position) => {
    if (!fromKey || !toKey || fromKey === toKey) return;
    setColumnOrder(order => {
      const next = order.filter(key => key !== fromKey);
      const targetIndex = next.indexOf(toKey);
      next.splice(position === 'after' ? targetIndex + 1 : targetIndex, 0, fromKey);
      return next;
    });
  };
  const confirmImport = () => {
    try {
      const imported = parseDemandCsv(importDraft.text, importDraft.mapping).map(d => normalizeDemand(d));
      const duplicateInFile = getDuplicateDemandNos(imported);
      if (duplicateInFile.length) throw new Error(`导入文件内需求单号重复：${duplicateInFile.join('、')}`);
      const duplicateExisting = imported.map(d => formatRr(d.demandNo || d.rr)).filter(demandNo => demands.some(existing => formatRr(existing.demandNo || existing.rr) === demandNo));
      if (duplicateExisting.length) throw new Error(`需求单号已存在，不能重复导入：${[...new Set(duplicateExisting)].join('、')}`);
      setDemands(ds => [...ds, ...imported.map((d, idx) => ({ ...d, id: Date.now() + idx }))]);
      setImportMsg(`已按字段映射导入 ${imported.length} 条需求`);
      setImportDraft(null);
    } catch (err) {
      setImportMsg(`导入失败：${err.message}`);
    }
  };
  const updateImportMapping = (key, header) => setImportDraft(draft => ({ ...draft, mapping: { ...draft.mapping, [key]: header } }));
  const importPreviewValue = (row, key) => {
    const header = importDraft?.mapping?.[key];
    const idx = importDraft?.headers?.indexOf(header);
    return idx >= 0 ? (row[idx] || '') : '';
  };
  const columns = columnOrder.map(key => ({ key, label: demandColumnLabels[key] })).filter(column => column.label);
  const dashboardTotalDays = monthFiltered.reduce((sum, d) => sum + toNumber(d.days), 0);
  React.useEffect(() => {
    updateFloatingScrollbar();
    window.addEventListener('scroll', updateFloatingScrollbar, true);
    window.addEventListener('resize', updateFloatingScrollbar);
    return () => {
      window.removeEventListener('scroll', updateFloatingScrollbar, true);
      window.removeEventListener('resize', updateFloatingScrollbar);
    };
  }, [columns.length, list.length, expandedId, columnFilters]);
  const demandPartyChoices = value => [...new Set([...demandPartyOptions, value].filter(Boolean))];
  const renderDemandCell = (d, key) => {
    if (key === 'title') return <button className="title-link" onClick={()=>setExpandedId(expandedId === d.id ? null : d.id)}>{d.title || '未填写需求名称'}</button>;
    if (key === 'demandNo') return <div className="stacked-control"><input style={fitStyle('demandNo')} className={isValidRr(d.demandNo) ? '' : 'invalid'} value={d.demandNo} placeholder="RR2026053012345" onChange={e=>updateDemand(d.id,'demandNo',e.target.value)}/>{!isValidRr(d.demandNo) && <small className="field-error">{rrFormatText}</small>}</div>;
    if (key === 'source') return <select style={fitStyle('source')} className={d.source === '临时紧急需求' ? 'danger-field' : ''} value={d.source} onChange={e=>updateDemand(d.id,'source',e.target.value)}>{demandTypeOptions.map(item => <option key={item} value={item}>{item}</option>)}</select>;
    if (key === 'investment') return <select style={fitStyle('investment')} value={d.investment} onChange={e=>updateDemand(d.id,'investment',e.target.value)}>{demandPartyChoices(d.investment).map(item => <option key={item} value={item}>{item}</option>)}</select>;
    if (key === 'priority') return <select style={fitStyle('priority')} value={d.priority} onChange={e=>updateDemand(d.id,'priority',e.target.value)}>{priorityOptions.map(priority => <option key={priority}>{priority}</option>) }</select>;
    if (key === 'landingDate') return <input style={fitStyle('landingDate')} type="date" value={d.landingDate || ''} onChange={e=>updateDemand(d.id,'landingDate',e.target.value)}/>;
    if (key === 'budgetStatus') return <select style={fitStyle('budgetStatus')} value={d.budgetStatus || '无预算'} onChange={e=>updateDemand(d.id,'budgetStatus',e.target.value)}>{budgetStatusOptions.map(status => <option key={status}>{status}</option>)}</select>;
    if (key === 'budgetAcquiredDate') return <input style={fitStyle('budgetAcquiredDate')} type="date" value={d.budgetAcquiredDate || ''} disabled={d.budgetStatus !== '已获取'} onChange={e=>updateDemand(d.id,'budgetAcquiredDate',e.target.value)}/>;
    if (key === 'budgetContact') return <input style={fitStyle('budgetContact')} value={d.budgetContact || ''} disabled={!hasBudget(d)} placeholder={hasBudget(d) ? '填写接口人' : '有预算后填写'} onChange={e=>updateDemand(d.id,'budgetContact',e.target.value)}/>;
    if (key === 'budgetEta') return <input style={fitStyle('budgetEta')} type="date" value={d.budgetEta || ''} disabled={!isBudgetCommitted(d.budgetStatus)} onChange={e=>updateDemand(d.id,'budgetEta',e.target.value)}/>;
    if (key === 'days') return <input style={fitStyle('days')} type="number" value={toNumber(d.days)} disabled={d.workloadMode === 'breakdown'} onChange={e=>updateDemand(d.id,'days',Number(e.target.value))}/>;
    if (key === 'finalDays') return <input style={fitStyle('finalDays')} type="number" value={toNumber(d.finalDays)} disabled={d.status !== '已验收'} placeholder={d.status === '已验收' ? '填写决算人力' : '验收后填写'} onChange={e=>updateDemand(d.id,'finalDays',Number(e.target.value))}/>;
    if (key === 'version') return <input style={fitStyle('version')} value={d.version} disabled={!isScheduled(d.status)} placeholder={isScheduled(d.status) ? '填写版本' : '排期后填写'} onChange={e=>updateDemand(d.id,'version',e.target.value)}/>;
    if (key === 'status') return <select style={fitStyle('status')} value={d.status} onChange={e=>updateDemand(d.id,'status',e.target.value)}>{demandStatusOptions.map(status => <option key={status}>{status}</option>)}</select>;
    if (key === 'settlementDays') return <input style={fitStyle('settlementDays')} type="number" value={toNumber(d.settlementDays)} disabled={d.status !== '已验收'} placeholder={d.status === '已验收' ? '填写结算人力' : '验收后填写'} onChange={e=>updateDemand(d.id,'settlementDays',Number(e.target.value))}/>;
    if (key === 'acceptanceCriteria') return <textarea className="table-textarea" style={fitStyle(key)} value={d[key] || ''} onChange={e=>updateDemand(d.id,key,e.target.value)}/>;
    return <input style={fitStyle(key)} value={d[key] || ''} onChange={e=>updateDemand(d.id,key,e.target.value)}/>;
  };
  return <>
    <Header title="需求池" desc="集中查看、筛选、导入和维护下月需求清单。"/>
    <Dashboard demands={monthFiltered} totalDays={dashboardTotalDays} compact/>
    <div className="toolbar demand-toolbar">
      <div className="actions"><input className="search-input" placeholder="全文检索：需求/单号/提出人/版本/RR/IR/状态" value={keyword} onChange={e=>setKeyword(e.target.value)}/><span className="month-filter-label">计划落地月份：</span><label className="month-filter-control"><span>开始月份</span><MonthSelect value={monthStart} onChange={setMonthStart} options={monthOptions}/></label><label className="month-filter-control"><span>结束月份</span><MonthSelect value={monthEnd} onChange={setMonthEnd} options={monthOptions}/></label></div>
      <div className="actions"><button onClick={clearAllFilters}>清除筛选</button><button onClick={()=>setColumnOrder(defaultColumnKeys)}>恢复默认列顺序</button><label className="import-btn">导入<input type="file" accept=".csv,text/csv" onChange={onImport}/></label><button onClick={()=>downloadCsv(demands)}>导出</button></div>
    </div>
    {importMsg && <div className="notice">{importMsg}</div>}
    {filteredIds && <div className="notice">{filteredIdsLabel}：当前展示 {list.length} 条匹配需求 <button className="link neutral" onClick={clearAllFilters}>清除筛选</button></div>}
    {importDraft && <section className="card import-mapping-card"><h2>导入字段映射</h2><p className="muted">系统已推荐自动映射结果。带 * 的字段为必填字段，请检查不准确的字段，改为正确的CSV表头，或选择“不导入”。</p><div className="import-mapping-table"><table><thead><tr>{demandImportFields.map(([key, label]) => <th key={key} title={label}><span className={requiredDemandImportFields.has(key) ? 'required-label' : ''}>{label}</span></th>)}</tr><tr>{demandImportFields.map(([key, label]) => <th key={key}><select title={importDraft.mapping[key] || '不导入'} value={importDraft.mapping[key] || ''} onChange={e=>updateImportMapping(key, e.target.value)}><option value="">不导入</option>{importDraft.headers.map(header => <option key={header} value={header} title={header}>{header}</option>)}</select></th>)}</tr></thead><tbody>{importDraft.previewRows?.length ? importDraft.previewRows.map((row, idx) => <tr key={idx}>{demandImportFields.map(([key, label]) => { const value = importPreviewValue(row, key); return <td key={key} title={value}>{value}</td>; })}</tr>) : <tr><td colSpan={demandImportFields.length}>没有可预览的数据行</td></tr>}</tbody></table></div><div className="modal-actions"><button className="secondary" onClick={()=>setImportDraft(null)}>取消</button><button className="primary inline" onClick={confirmImport}>按映射导入</button></div></section>}
    <datalist id="demand-party-options">{demandPartyOptions.map(item => <option key={item} value={item}/>)}</datalist>
    <div className="scroll-hint">表格可横向拖动查看全部字段，列宽可拖拽调整，表头可拖拽调整列顺序</div>
    <div className="table-scroll-proxy" ref={topScrollRef} style={scrollProxyStyle} onPointerDown={startScrollDrag} onPointerMove={moveScrollDrag} onPointerUp={endScrollDrag} onPointerCancel={endScrollDrag}><div className="table-scroll-thumb" style={scrollThumbStyle}/></div>
    <div className="card table-card demand-table-card" ref={tableScrollRef} onScroll={updateFloatingScrollbar}><table ref={tableRef}><thead><tr>{columns.map(column => <th key={column.key} style={fitStyle(column.key)} draggable className={`draggable-th ${draggingColumn === column.key ? 'dragging-th' : ''} ${dropTarget?.key === column.key ? 'drop-target-th' : ''}`} onDragStart={e=>{ setDraggingColumn(column.key); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', column.key); }} onDragOver={e=>{ e.preventDefault(); const position = e.nativeEvent.offsetX > e.currentTarget.offsetWidth / 2 ? 'after' : 'before'; setDropTarget({ key: column.key, position }); }} onDrop={e=>{ e.preventDefault(); moveColumn(e.dataTransfer.getData('text/plain') || draggingColumn, column.key, dropTarget?.position || 'before'); setDraggingColumn(''); setDropTarget(null); }} onDragEnd={()=>{ setDraggingColumn(''); setDropTarget(null); }}><div className="th-filter"><span className={requiredDemandImportFields.has(column.key) ? 'required-label' : ''}><span className="column-drag-handle">↕</span>{column.label}<button className="sort-btn" draggable={false} onClick={e=>{ e.stopPropagation(); toggleDateSort(column.key); }}>{dateSort.key === column.key ? (dateSort.direction === 'asc' ? '↑' : '↓') : '↕'}</button></span><input style={fitStyle(column.key)} value={columnFilters[column.key] || ''} placeholder="筛选" onChange={e=>setColumnFilter(column.key, e.target.value)}/></div></th>)}<th>操作</th></tr></thead><tbody>{list.map(d => <React.Fragment key={d.id}>
      <tr id={`demand-row-${d.id}`}>{columns.map(column => <td key={column.key} style={fitStyle(column.key)}>{renderDemandCell(d, column.key)}</td>)}<td><button className="link" onClick={()=>deleteDemand(d.id)}>删除</button></td></tr>
      {expandedId === d.id && <tr className="detail-row"><td colSpan={columns.length + 1}><div className="submit-layout detail-submit-layout">
        <section className="submit-section primary-info"><h2>基础信息</h2><div className="submit-grid five"><label><span className="required-label">需求名称</span><input value={d.title} onChange={e=>updateDemand(d.id,'title',e.target.value)}/></label><label><span className="required-label">需求单号</span><input className={isValidRr(d.demandNo) ? '' : 'invalid'} value={d.demandNo} placeholder="RR2026053012345" onChange={e=>updateDemand(d.id,'demandNo',e.target.value)}/>{!isValidRr(d.demandNo) && <small className="field-error">{rrFormatText}</small>}</label><label><span className="required-label">提出人</span><input value={d.requester} onChange={e=>updateDemand(d.id,'requester',e.target.value)}/></label><label>需求BA<input value={d.demandBA || ''} onChange={e=>updateDemand(d.id,'demandBA',e.target.value)}/></label><label>需求PM<input value={d.demandPM || ''} onChange={e=>updateDemand(d.id,'demandPM',e.target.value)}/></label><label><span className="required-label">需求方</span><select value={d.investment} onChange={e=>updateDemand(d.id,'investment',e.target.value)}>{demandPartyChoices(d.investment).map(item => <option key={item} value={item}>{item}</option>)}</select></label></div></section>
        <section className="submit-section"><h2>分类与排期</h2><div className="submit-grid five"><label>类型<select className={d.source === '临时紧急需求' ? 'danger-field' : ''} value={d.source} onChange={e=>updateDemand(d.id,'source',e.target.value)}>{demandTypeOptions.map(item => <option key={item} value={item}>{item}</option>)}</select></label><label>优先级<select value={d.priority} onChange={e=>updateDemand(d.id,'priority',e.target.value)}>{priorityOptions.map(priority => <option key={priority}>{priority}</option>) }</select></label><label>需求状态<select value={d.status} onChange={e=>updateDemand(d.id,'status',e.target.value)}>{demandStatusOptions.map(status => <option key={status}>{status}</option>)}</select></label><label>版本<input value={d.version} disabled={!isScheduled(d.status)} placeholder={isScheduled(d.status) ? '填写版本' : '排期后填写'} onChange={e=>updateDemand(d.id,'version',e.target.value)}/></label><label>计划落地日期<input type="date" value={d.landingDate || ''} onChange={e=>updateDemand(d.id,'landingDate',e.target.value)}/></label></div></section>
        <div className="submit-two-cols"><section className="submit-section"><h2>预算信息</h2><div className="submit-grid four"><label>预算状态<select value={d.budgetStatus || '无预算'} onChange={e=>updateDemand(d.id,'budgetStatus',e.target.value)}>{budgetStatusOptions.map(status => <option key={status}>{status}</option>)}</select></label><label>预算金额w<input type="number" value={toNumber(d.budget)} disabled={!hasBudget(d)} onChange={e=>updateDemand(d.id,'budget',Number(e.target.value))}/></label><label>预算接口人<input value={d.budgetContact} disabled={!hasBudget(d)} placeholder={hasBudget(d) ? '填写接口人' : '有预算后填写'} onChange={e=>updateDemand(d.id,'budgetContact',e.target.value)}/></label><label>预算承诺日期<input type="date" value={d.budgetEta || ''} disabled={!isBudgetCommitted(d.budgetStatus)} onChange={e=>updateDemand(d.id,'budgetEta',e.target.value)}/></label><label>预算获取日期（SMP系统）<input type="date" value={d.budgetAcquiredDate || ''} disabled={d.budgetStatus !== '已获取'} onChange={e=>updateDemand(d.id,'budgetAcquiredDate',e.target.value)}/></label></div></section><section className="submit-section"><h2>工作量信息</h2><WorkloadFields value={d} set={(key, val)=>updateDemand(d.id, key, val)} showSettlement/></section></div>
        <section className="submit-section"><h2>需求说明</h2><div className="submit-grid four textareas"><label>当前业务痛点<textarea value={d.pain} onChange={e=>updateDemand(d.id,'pain',e.target.value)}/></label><label>需求目标<textarea value={d.goal} onChange={e=>updateDemand(d.id,'goal',e.target.value)}/></label><label>需求价值<textarea value={d.value} onChange={e=>updateDemand(d.id,'value',e.target.value)}/></label><label className="wide-2">验收标准<textarea value={d.acceptanceCriteria || ''} onChange={e=>updateDemand(d.id,'acceptanceCriteria',e.target.value)}/></label></div></section>
      </div></td></tr>}
    </React.Fragment>)}</tbody></table></div>
  </>;
}

const RequiredLabel = ({ children }) => <span className="required-label">{children}</span>;

function WorkloadFields({ value, set, showSettlement = false }) {
  const isBreakdown = value.workloadMode === 'breakdown';
  const isAccepted = value.status === '已验收';
  return <div className="workload-fields">
    <div className="submit-grid two workload-row"><label><RequiredLabel>填写方式</RequiredLabel><select value={value.workloadMode || 'total'} onChange={e=>set('workloadMode',e.target.value)}><option value="total">按总量</option><option value="breakdown">按分项</option></select></label><label><RequiredLabel>总人天</RequiredLabel><input type="number" value={toNumber(value.days)} disabled={isBreakdown} placeholder={isBreakdown ? '按分项自动汇总' : '填写总人天'} onChange={e=>set('days',Number(e.target.value))}/></label></div>
    <div className="submit-grid four workload-row"><label>分析<input type="number" value={toNumber(value.analysis)} disabled={!isBreakdown} onChange={e=>set('analysis',Number(e.target.value))}/></label><label>前端<input type="number" value={toNumber(value.frontend)} disabled={!isBreakdown} onChange={e=>set('frontend',Number(e.target.value))}/></label><label>中台<input type="number" value={toNumber(value.middle)} disabled={!isBreakdown} onChange={e=>set('middle',Number(e.target.value))}/></label><label>后台<input type="number" value={toNumber(value.backend)} disabled={!isBreakdown} onChange={e=>set('backend',Number(e.target.value))}/></label></div>
    <div className="submit-grid two workload-row workload-final-row">{showSettlement && <label>结算人力<input type="number" value={toNumber(value.settlementDays)} disabled={!isAccepted} placeholder={isAccepted ? '填写结算人力' : '验收后填写'} onChange={e=>set('settlementDays',Number(e.target.value))}/></label>}<label>决算人力<input type="number" value={toNumber(value.finalDays)} disabled={!isAccepted} placeholder={isAccepted ? '填写决算人力' : '验收后填写'} onChange={e=>set('finalDays',Number(e.target.value))}/></label></div>
  </div>;
}

function DemandSubmit({demands, setDemands, goPool}) {
  const [form, setForm] = useState(createEmptyDemand);
  const set = (k,v)=>{
    if ((k === 'rr' || k === 'demandNo') && !isValidRrInput(v)) return;
    setForm(f=>normalizeDemand({...f,[k]:v}));
  };
  const submit = () => {
    const error = validateDemand(form, demands);
    if (error) {
      alert(error);
      return;
    }
    setDemands(ds=>[...ds,{...normalizeDemand(form),id:Date.now()}]);
    goPool();
  };
  return <><Header title="提交需求" desc="按结构化表单一次性登记需求核心信息。"/><div className="submit-layout card submit-card">
    <section className="submit-section primary-info"><h2>基础信息</h2><div className="submit-grid five"><label><RequiredLabel>需求名称</RequiredLabel><input value={form.title} onChange={e=>set('title',e.target.value)}/></label><label><RequiredLabel>需求单号</RequiredLabel><input className={form.demandNo && !isValidRr(form.demandNo) ? 'invalid' : ''} value={form.demandNo} placeholder="RR2026053012345" onChange={e=>set('demandNo',e.target.value)}/>{form.demandNo && !isValidRr(form.demandNo) && <small className="field-error">{rrFormatText}</small>}</label><label><RequiredLabel>提出人</RequiredLabel><input value={form.requester} onChange={e=>set('requester',e.target.value)}/></label><label>需求BA<input value={form.demandBA || ''} onChange={e=>set('demandBA',e.target.value)}/></label><label>需求PM<input value={form.demandPM || ''} onChange={e=>set('demandPM',e.target.value)}/></label><label><RequiredLabel>需求方</RequiredLabel><select value={form.investment} onChange={e=>set('investment',e.target.value)}>{demandPartyOptions.map(item => <option key={item} value={item}>{item}</option>)}</select></label></div></section>
    <section className="submit-section"><h2>分类与排期</h2><div className="submit-grid five"><label><RequiredLabel>类型</RequiredLabel><select className={form.source === '临时紧急需求' ? 'danger-field' : ''} value={form.source} onChange={e=>set('source',e.target.value)}>{demandTypeOptions.map(item => <option key={item} value={item}>{item}</option>)}</select></label><label><RequiredLabel>优先级</RequiredLabel><select value={form.priority} onChange={e=>set('priority',e.target.value)}>{priorityOptions.map(priority => <option key={priority}>{priority}</option>) }</select></label><label><RequiredLabel>需求状态</RequiredLabel><select value={form.status} onChange={e=>set('status',e.target.value)}>{demandStatusOptions.map(status => <option key={status}>{status}</option>)}</select></label><label>版本<input value={form.version} disabled={!isScheduled(form.status)} placeholder={isScheduled(form.status) ? '填写版本' : '排期后填写'} onChange={e=>set('version',e.target.value)}/></label><label><RequiredLabel>计划落地日期</RequiredLabel><input type="date" value={form.landingDate} onChange={e=>set('landingDate',e.target.value)}/></label></div></section>
    <div className="submit-two-cols"><section className="submit-section"><h2>预算信息</h2><div className="submit-grid four"><label><RequiredLabel>预算状态</RequiredLabel><select value={form.budgetStatus} onChange={e=>set('budgetStatus',e.target.value)}>{budgetStatusOptions.map(status => <option key={status}>{status}</option>)}</select></label><label>预算金额w<input type="number" value={form.budget} disabled={!hasBudget(form)} onChange={e=>set('budget',Number(e.target.value))}/></label><label>预算接口人<input value={form.budgetContact} disabled={!hasBudget(form)} placeholder={hasBudget(form) ? '填写接口人' : '有预算后填写'} onChange={e=>set('budgetContact',e.target.value)}/></label><label>预算承诺日期<input type="date" value={form.budgetEta} disabled={!isBudgetCommitted(form.budgetStatus)} onChange={e=>set('budgetEta',e.target.value)}/></label>{form.budgetStatus === '已获取' && <label>预算获取日期（SMP系统）<input type="date" value={form.budgetAcquiredDate || ''} onChange={e=>set('budgetAcquiredDate',e.target.value)}/></label>}</div></section><section className="submit-section"><h2>工作量信息</h2><WorkloadFields value={form} set={set}/></section></div>
    <section className="submit-section"><h2>需求说明</h2><div className="submit-grid four textareas"><label>当前业务痛点<textarea value={form.pain} onChange={e=>set('pain',e.target.value)}/></label><label>需求目标<textarea value={form.goal} onChange={e=>set('goal',e.target.value)}/></label><label>需求价值<textarea value={form.value} onChange={e=>set('value',e.target.value)}/></label><label className="wide-2">验收标准<textarea value={form.acceptanceCriteria || ''} onChange={e=>set('acceptanceCriteria',e.target.value)}/></label></div></section>
    <div className="submit-actions"><button className="primary" onClick={submit}>提交需求</button></div>
  </div></>;
}

const personnelImportFields = [
  ['name', '人员姓名', ['人员姓名', '姓名', '人员']], ['employeeNo', '工号', ['工号', '员工号', '人员编号']], ['owner', '负责人', ['负责人', '归属负责人', '团队负责人']], ['position', '岗位', ['岗位', '职位', '角色']], ['location', '地点', ['地点', '办公地点', '城市', '所在地']], ['supplier', '供应商', ['供应商', '厂商']], ['entryDate', '入项时间', ['入项时间', '入场时间', '入项日期']], ['dailyCost', '人天成本（元/人天）', ['人天成本（元/人天）', '人天成本', '元/人天']], ['monthlyDays', '月度可用人天', ['月度可用人天', '月可用人天']]
];
const requiredPersonnelImportFields = new Set(['name', 'employeeNo', 'dailyCost']);
const personnelImportFieldMap = Object.fromEntries(personnelImportFields.map(([key, label, aliases]) => [key, { label, aliases }]));
function guessPersonnelImportMapping(headers) {
  const used = new Set();
  const mapping = {};
  personnelImportFields.forEach(([key, , aliases]) => {
    const match = aliases.find(alias => headers.includes(alias));
    if (match && !used.has(headers.indexOf(match))) { mapping[key] = match; used.add(headers.indexOf(match)); }
    else mapping[key] = '';
  });
  return mapping;
}
function parsePersonnelCsv(text, fieldMapping) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('CSV至少需要表头和一行数据');
  const headers = rows[0].map(h => h.trim());
  const get = (record, key, fallback = '') => {
    const header = fieldMapping?.[key];
    const names = header ? [header] : personnelImportFieldMap[key].aliases;
    for (const name of names) {
      const idx = headers.indexOf(name);
      if (idx >= 0 && record[idx] !== undefined && String(record[idx]).trim() !== '') return String(record[idx]).trim();
    }
    return fallback;
  };
  return rows.slice(1).filter(row => row.some(cell => String(cell ?? '').trim() !== '')).map((record, idx) => ({
    id: Date.now() + idx,
    name: get(record, 'name'),
    employeeNo: get(record, 'employeeNo'),
    owner: get(record, 'owner'),
    position: personnelPositionOptions.includes(get(record, 'position')) ? get(record, 'position') : '后端',
    location: get(record, 'location'),
    supplier: get(record, 'supplier'),
    entryDate: get(record, 'entryDate'),
    dailyCost: toNumber(get(record, 'dailyCost')),
    monthlyDays: toNumber(get(record, 'monthlyDays', '22.5')) || 22.5
  })).filter(p => p.name || p.employeeNo);
}
function downloadPersonnelCsv(personnel) {
  const headers = personnelImportFields.map(([, label]) => label);
  const lines = [headers.join(',')].concat(personnel.map(p => [p.name,p.employeeNo,p.owner,p.position,p.location,p.supplier,p.entryDate,p.dailyCost,p.monthlyDays].map(v=>`"${String(v ?? '').replaceAll('"','""')}"`).join(',')));
  const blob = new Blob(['\ufeff' + lines.join('\n')], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'personnel.csv'; a.click();
}

const personnelRoleDefinitions = [
  { role: '设计', definition: '负责交互方案、视觉设计、设计规范和体验走查。' },
  { role: '前端', definition: '负责前端页面、交互逻辑、接口联调和前端质量保障。' },
  { role: '后端', definition: '负责服务端接口、业务逻辑、数据模型和系统稳定性。' },
  { role: '数据', definition: '负责数据建模、指标口径、报表开发和数据质量校验。' },
  { role: 'UX', definition: '负责用户研究、流程体验、可用性验证和体验改进建议。' },
  { role: '测试', definition: '负责测试方案、用例执行、缺陷跟踪和上线质量把关。' },
  { role: 'PM', definition: '负责需求排期、资源协调、进度跟踪、风险识别和交付闭环。' }
];

function addMonths(month, offset) {
  const [year, value] = String(month).split('-').map(Number);
  const date = new Date(year, (value || 1) - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function buildYearMonthOptions(base = getCurrentMonthKey()) {
  return Array.from({ length: 12 }, (_, idx) => addMonths(base, idx));
}

function buildPersonnelTrendRows(personnel, budget, monthStart, monthEnd) {
  const months = [];
  let cursor = monthStart;
  while (cursor <= monthEnd && months.length < 36) { months.push(cursor); cursor = addMonths(cursor, 1); }
  return months.map(month => {
    const active = personnel.filter(p => !p.entryDate || String(p.entryDate).slice(0, 7) <= month);
    const headcount = active.length;
    const monthlyDays = active.reduce((s, p) => s + toNumber(p.monthlyDays || 22.5), 0);
    const monthlyCost = active.reduce((s, p) => s + toNumber(p.dailyCost) * toNumber(p.monthlyDays || 22.5) / 10000, 0);
    const monthBudget = (budget?.pools || []).filter(pool => !pool.month || pool.month === month).reduce((s, pool) => s + getBudgetPoolAmount(pool), 0);
    return { month, headcount, monthlyDays, monthlyCost, monthBudget };
  });
}

function buildPersonnelTrendOption(rows) {
  return {
    color: ['#2563eb', '#16a34a', '#f97316'],
    tooltip: { trigger: 'axis', formatter: params => params.map(p => `${p.seriesName}: ${p.seriesName === '人力数量' ? p.value + '人' : p.value + 'w'}`).join('<br/>') },
    legend: { top: 0 },
    grid: { left: 56, right: 58, top: 42, bottom: 38 },
    xAxis: { type: 'category', data: rows.map(r => r.month) },
    yAxis: [{ type: 'value', name: '人数' }, { type: 'value', name: 'w' }],
    series: [
      { name: '人力数量', type: 'line', smooth: true, data: rows.map(r => r.headcount) },
      { name: '人力成本', type: 'line', smooth: true, yAxisIndex: 1, data: rows.map(r => Number(r.monthlyCost.toFixed(1))) },
      { name: '预算额度', type: 'line', smooth: true, yAxisIndex: 1, data: rows.map(r => Number(r.monthBudget.toFixed(1))) }
    ]
  };
}


function getPersonnelAverageDayCost(personnel, budget) {
  const costRows = personnel.filter(p => toNumber(p.dailyCost) > 0);
  if (!costRows.length) return getBudgetDayCost(budget);
  return costRows.reduce((sum, p) => sum + toNumber(p.dailyCost), 0) / costRows.length / 10000;
}

function getDemandEstimatedCostByPersonnel(demand, dayCost) {
  return toNumber(demand.days) * dayCost;
}

function getDemandExecutionCostByPersonnel(demand, dayCost) {
  return getExecutionDays(demand) * dayCost;
}

function buildDemandCostRows(demands, personnel, budget) {
  const dayCost = getPersonnelAverageDayCost(personnel, budget);
  return demands.map(d => {
    const estimatedDays = toNumber(d.days);
    const executionDays = getExecutionDays(d);
    const estimatedCost = getDemandEstimatedCostByPersonnel(d, dayCost);
    const executionCost = getDemandExecutionCostByPersonnel(d, dayCost);
    const budgetAmount = toNumber(d.budget);
    const balance = budgetAmount - executionCost;
    const status = budgetAmount <= 0 && executionCost > 0 ? '无预算' : balance < 0 ? '预算不足' : '正常';
    return {
      ...d,
      demandId: d.demandNo || d.rr || d.id,
      month: getDemandMonth(d),
      investment: d.investment || '未填写需求方',
      demandPM: d.demandPM || '未填写PM',
      estimatedDays,
      executionDays,
      dayCost,
      estimatedCost,
      executionCost,
      budgetAmount,
      balance,
      costStatus: status
    };
  }).sort((a, b) => sortBudgetPlanMonth(a.month, b.month) || String(a.demandId).localeCompare(String(b.demandId)));
}

function buildPersonnelCostTrendRows(personnel, demands, budget, monthStart, monthEnd) {
  const demandCostRows = buildDemandCostRows(demands, personnel, budget);
  const months = [];
  let cursor = monthStart;
  while (cursor <= monthEnd && months.length < 36) { months.push(cursor); cursor = addMonths(cursor, 1); }
  return months.map(month => {
    const active = personnel.filter(p => !p.entryDate || String(p.entryDate).slice(0, 7) <= month);
    const manpowerCost = active.reduce((s, p) => s + toNumber(p.dailyCost) * toNumber(p.monthlyDays || 22.5) / 10000, 0);
    const monthDemands = demandCostRows.filter(row => row.month === month);
    const estimatedDemandCost = monthDemands.reduce((s, row) => s + row.estimatedCost, 0);
    const executionDemandCost = monthDemands.reduce((s, row) => s + row.executionCost, 0);
    const monthBudget = (budget?.pools || []).filter(pool => !pool.month || pool.month === month).reduce((s, pool) => s + getBudgetPoolAmount(pool), 0);
    return { month, manpowerCost, estimatedDemandCost, executionDemandCost, monthBudget, demandCount: monthDemands.length };
  });
}

function buildPersonnelCostTrendOption(rows) {
  return {
    color: ['#2563eb', '#16a34a', '#f97316', '#7c3aed'],
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: value => `${value}w` },
    legend: { top: 0 },
    grid: { left: 56, right: 34, top: 42, bottom: 38 },
    xAxis: { type: 'category', data: rows.map(r => r.month) },
    yAxis: { type: 'value', name: 'w' },
    series: [
      { name: '月度人力可用成本', type: 'bar', data: rows.map(r => Number(r.manpowerCost.toFixed(1))) },
      { name: '需求预估费用', type: 'bar', data: rows.map(r => Number(r.estimatedDemandCost.toFixed(1))) },
      { name: '需求执行费用', type: 'bar', data: rows.map(r => Number(r.executionDemandCost.toFixed(1))) },
      { name: '预算额度', type: 'line', smooth: true, data: rows.map(r => Number(r.monthBudget.toFixed(1))) }
    ]
  };
}

function Personnel({personnel, setPersonnel, demands = [], budget, openDemand}) {
  const [importMsg, setImportMsg] = useState('');
  const [importDraft, setImportDraft] = useState(null);
  const [addDraft, setAddDraft] = useState(null);
  const [personnelSort, setPersonnelSort] = useState({ key: '', direction: 'asc' });
  const defaultTrendStart = `${new Date().getFullYear()}-01`;
  const [monthStart, setMonthStart] = useState(defaultTrendStart);
  const [monthEnd, setMonthEnd] = useState(addMonths(defaultTrendStart, 11));
  const normalized = personnel.map((p, idx) => ({ id: p.id || Date.now() + idx, name: p.name || '', employeeNo: p.employeeNo || '', owner: p.owner || '', position: personnelPositionOptions.includes(p.position) ? p.position : '后端', location: p.location || '', supplier: p.supplier || '', entryDate: p.entryDate || '', dailyCost: toNumber(p.dailyCost || 0), monthlyDays: toNumber(p.monthlyDays || 22.5) }));
  const sortedPersonnel = useMemo(() => sortRows(normalized, personnelSort), [normalized, personnelSort]);
  const update=(id,k,v)=>{
    if (k === 'employeeNo') {
      const employeeNo = String(v).trim();
      if (employeeNo && normalized.some(p => p.id !== id && String(p.employeeNo).trim() === employeeNo)) { alert(`工号已存在：${employeeNo}`); return; }
    }
    setPersonnel(ps=>normalized.map(p=>p.id===id?{...p,[k]:v}:p));
  };
  const openAddPersonnel = () => setAddDraft({ name: '', employeeNo: '' });
  const confirmAddPersonnel=()=>{
    const name = addDraft.name.trim();
    const employeeNo = addDraft.employeeNo.trim();
    if (!name) { alert('新增人员失败：请填写人员姓名'); return; }
    if (!employeeNo) { alert('新增人员失败：请填写工号'); return; }
    if (normalized.some(p => String(p.employeeNo).trim() === employeeNo)) { alert(`新增人员失败：工号已存在：${employeeNo}`); return; }
    setPersonnel(ps=>[...normalized,{id:Date.now(),name,employeeNo,owner:'',position:'后端',location:'',supplier:'',entryDate:'',dailyCost:0,monthlyDays:22.5}]);
    setAddDraft(null);
  };
  const deletePersonnel=id=>setPersonnel(ps=>normalized.filter(p=>p.id!==id));
  const updateImportMapping = (key, header) => setImportDraft(draft => ({ ...draft, mapping: { ...draft.mapping, [key]: header } }));
  const importPreviewValue = (row, key) => { const idx = importDraft?.headers?.indexOf(importDraft?.mapping?.[key]); return idx >= 0 ? (row[idx] || '') : ''; };
  const onImport = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length < 2) throw new Error('CSV至少需要表头和一行数据');
      const headers = rows[0].map(h => h.trim()).filter(Boolean);
      const previewRows = rows.slice(1).filter(row => row.some(cell => String(cell ?? '').trim() !== '')).slice(0, 5);
      setImportDraft({ text, headers, mapping: guessPersonnelImportMapping(headers), previewRows });
      setImportMsg('已读取文件，请确认字段映射后导入');
    } catch (err) { setImportMsg(`导入失败：${err.message}`); }
    finally { event.target.value = ''; }
  };
  const confirmImport = () => {
    try {
      const imported = parsePersonnelCsv(importDraft.text, importDraft.mapping);
      if (!imported.length) throw new Error('没有可导入的人员数据');
      setPersonnel(ps => [...normalized, ...imported]);
      setImportMsg(`已按字段映射导入 ${imported.length} 条人员管理`);
      setImportDraft(null);
    } catch (err) { setImportMsg(`导入失败：${err.message}`); }
  };
  const totalMonthlyDays = normalized.reduce((s, p) => s + toNumber(p.monthlyDays), 0);
  const monthOptions = useMemo(() => buildYearMonthOptions(defaultTrendStart), [defaultTrendStart]);
  const trendRows = useMemo(() => buildPersonnelTrendRows(normalized, budget, monthStart, monthEnd), [normalized, budget, monthStart, monthEnd]);
  const averageDayCost = useMemo(() => getPersonnelAverageDayCost(normalized, budget), [normalized, budget]);
  const demandCostRows = useMemo(() => buildDemandCostRows(demands, normalized, budget), [demands, normalized, budget]);
  const costTrendRows = useMemo(() => buildPersonnelCostTrendRows(normalized, demands, budget, monthStart, monthEnd), [normalized, demands, budget, monthStart, monthEnd]);
  const demandEstimatedCost = demandCostRows.reduce((sum, row) => sum + row.estimatedCost, 0);
  const demandExecutionCost = demandCostRows.reduce((sum, row) => sum + row.executionCost, 0);
  const demandBudgetAmount = demandCostRows.reduce((sum, row) => sum + row.budgetAmount, 0);
  const costGap = demandBudgetAmount - demandExecutionCost;
  const fmt = value => Number(value || 0).toFixed(1);
  return <><div className="kpi-grid four"><Kpi label="人员总数" value={`${normalized.length} 人`}/><Kpi label="月度可用人天" value={`${totalMonthlyDays.toFixed(1)} 人天`}/><Kpi label="平均人天成本" value={`${fmt(averageDayCost)}w/人天`}/><Kpi label="需求执行费用" value={`${fmt(demandExecutionCost)}w`} sub={`预估 ${fmt(demandEstimatedCost)}w`}/><Kpi label="预算费用差额" value={`${fmt(costGap)}w`} tone={costGap<0?'danger':'ok'}/></div><section className="budget-exec-card"><div className="toolbar"><h2>人力数量、成本与预算趋势</h2><div className="actions"><span className="month-filter-label">月份范围：</span><label className="month-filter-control"><span>开始月份</span><MonthSelect value={monthStart} onChange={setMonthStart} options={monthOptions}/></label><label className="month-filter-control"><span>结束月份</span><MonthSelect value={monthEnd} onChange={setMonthEnd} options={monthOptions}/></label></div></div><ReactECharts className="budget-exec-chart" option={buildPersonnelTrendOption(trendRows)} notMerge lazyUpdate/><MiniTable rows={trendRows.map(r => ({ ...r, monthlyDaysText: `${fmt(r.monthlyDays)}人天`, monthlyCostText: `${fmt(r.monthlyCost)}w`, monthBudgetText: `${fmt(r.monthBudget)}w` }))} cols={[["month","月份"],["headcount","人力数量"],["monthlyDaysText","月度人天"],["monthlyCostText","人力成本"],["monthBudgetText","预算额度"]]}/></section><section className="budget-exec-card"><h2>月度人力费用与需求费用占用</h2><ReactECharts className="budget-exec-chart" option={buildPersonnelCostTrendOption(costTrendRows)} notMerge lazyUpdate/><MiniTable rows={costTrendRows.map(r => ({ ...r, manpowerCostText: `${fmt(r.manpowerCost)}w`, estimatedDemandCostText: `${fmt(r.estimatedDemandCost)}w`, executionDemandCostText: `${fmt(r.executionDemandCost)}w`, monthBudgetText: `${fmt(r.monthBudget)}w` }))} cols={[["month","月份"],["manpowerCostText","月度人力可用成本"],["estimatedDemandCostText","需求预估费用"],["executionDemandCostText","需求执行费用"],["monthBudgetText","预算额度"],["demandCount","需求数"]]}/></section><section className="budget-exec-card"><h2>需求费用明细</h2><MiniTable rows={demandCostRows.map(r => ({ ...r, demandLink: <button className="risk-id-link" onClick={()=>openDemand?.(r.id)}>{r.demandId}</button>, dayCostText: `${fmt(r.dayCost)}w/人天`, estimatedCostText: `${fmt(r.estimatedCost)}w`, executionCostText: `${fmt(r.executionCost)}w`, budgetAmountText: `${fmt(r.budgetAmount)}w`, balanceText: `${fmt(r.balance)}w`, statusBadge: <span className={`risk-badge ${r.costStatus === '正常' ? 'risk-low' : 'risk-high'}`}>{r.costStatus}</span> }))} cols={[["demandLink","需求ID"],["title","名称"],["month","计划落地月份"],["investment","需求方"],["demandPM","需求PM"],["estimatedDays","预估人天"],["finalDays","决算人力"],["settlementDays","结算人力"],["dayCostText","成本口径"],["estimatedCostText","预估费用"],["executionCostText","执行费用"],["budgetAmountText","预算金额"],["balanceText","费用差额"],["statusBadge","状态"]]}/></section><section className="card"><h2>角色定义清单</h2><p className="muted">当前系统涉及的人员角色和职责边界如下。</p><MiniTable rows={personnelRoleDefinitions} cols={[["role","角色"],["definition","职责说明"]]}/></section><div className="toolbar"><div className="actions"></div><div className="actions"><button onClick={openAddPersonnel}>新增人员</button><label className="import-btn">导入<input type="file" accept=".csv,text/csv" onChange={onImport}/></label><button onClick={()=>downloadPersonnelCsv(normalized)}>导出</button></div></div>{importMsg && <div className="notice">{importMsg}</div>}{addDraft && <div className="modal-backdrop"><div className="modal-card"><div className="modal-header"><h2>新增人员</h2><button className="secondary" onClick={()=>setAddDraft(null)}>关闭</button></div><div className="form small"><label><span className="required-label">人员姓名</span><input value={addDraft.name} placeholder="请输入姓名" onChange={e=>setAddDraft(d=>({...d,name:e.target.value}))}/></label><label><span className="required-label">工号</span><input value={addDraft.employeeNo} placeholder="请输入工号" onChange={e=>setAddDraft(d=>({...d,employeeNo:e.target.value}))}/></label></div><div className="modal-actions"><button className="secondary" onClick={()=>setAddDraft(null)}>取消</button><button className="primary inline" onClick={confirmAddPersonnel}>确认新增</button></div></div></div>}{importDraft && <section className="card import-mapping-card"><h2>导入字段映射</h2><p className="muted">系统已推荐自动映射结果。带 * 的字段为必填字段，请检查不准确的字段，改为正确的CSV表头，或选择“不导入”。</p><div className="import-mapping-table"><table><thead><tr>{personnelImportFields.map(([key, label]) => <th key={key} title={label}><span className={requiredPersonnelImportFields.has(key) ? 'required-label' : ''}>{label}</span></th>)}</tr><tr>{personnelImportFields.map(([key]) => <th key={key}><select title={importDraft.mapping[key] || '不导入'} value={importDraft.mapping[key] || ''} onChange={e=>updateImportMapping(key, e.target.value)}><option value="">不导入</option>{importDraft.headers.map(header => <option key={header} value={header} title={header}>{header}</option>)}</select></th>)}</tr></thead><tbody>{importDraft.previewRows?.length ? importDraft.previewRows.map((row, idx) => <tr key={idx}>{personnelImportFields.map(([key]) => { const value = importPreviewValue(row, key); return <td key={key} title={value}>{value}</td>; })}</tr>) : <tr><td colSpan={personnelImportFields.length}>没有可预览的数据行</td></tr>}</tbody></table></div><div className="modal-actions"><button className="secondary" onClick={()=>setImportDraft(null)}>取消</button><button className="primary inline" onClick={confirmImport}>按映射导入</button></div></section>}<div className="scroll-hint">表格可横向拖动查看全部字段</div><div className="card table-card"><table><thead><tr>{[['name','人员姓名',true],['employeeNo','工号',true],['owner','负责人'],['position','岗位'],['location','地点'],['supplier','供应商'],['entryDate','入项时间'],['dailyCost','人天成本（元/人天）',true],['monthlyDays','月度可用人天']].map(([key,label,required]) => <th key={key}><button className="table-sort-trigger" onClick={()=>setPersonnelSort(current=>toggleSort(current, key))}><span className={required ? 'required-label' : ''}>{label}</span><span className="sort-indicator">{personnelSort.key === key ? (personnelSort.direction === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span></button></th>)}<th>操作</th></tr></thead><tbody>{sortedPersonnel.map(p=><tr key={p.id}><td><input value={p.name} placeholder="姓名" onChange={e=>update(p.id,'name',e.target.value)}/></td><td><input value={p.employeeNo} placeholder="工号" onChange={e=>update(p.id,'employeeNo',e.target.value)}/></td><td><input value={p.owner} placeholder="负责人" onChange={e=>update(p.id,'owner',e.target.value)}/></td><td><select value={p.position} onChange={e=>update(p.id,'position',e.target.value)}>{personnelPositionOptions.map(position => <option key={position}>{position}</option>)}</select></td><td><input value={p.location} placeholder="地点" onChange={e=>update(p.id,'location',e.target.value)}/></td><td><input value={p.supplier} placeholder="供应商" onChange={e=>update(p.id,'supplier',e.target.value)}/></td><td><input type="date" value={p.entryDate} onChange={e=>update(p.id,'entryDate',e.target.value)}/></td><td><input type="number" value={p.dailyCost} onChange={e=>update(p.id,'dailyCost',Number(e.target.value))}/></td><td><input type="number" value={p.monthlyDays} onChange={e=>update(p.id,'monthlyDays',Number(e.target.value))}/></td><td><button className="link" onClick={()=>deletePersonnel(p.id)}>删除</button></td></tr>)}</tbody></table></div></>;
}



function BudgetManagementPage({ demands, budget, setBudget, openDemandIds }) {
  const sourceRows = useMemo(() => buildDemandBudgetSourceRows(demands, budget), [demands, budget]);
  const poolRows = useMemo(() => buildBudgetPoolRows(demands, budget), [demands, budget]);
  const demandPools = useMemo(() => (budget.pools || []).filter(pool => pool.type !== 'department-baseline' && !String(pool.ownerDept || pool.name || '').includes('部门基线')), [budget]);
  const baselinePools = useMemo(() => (budget.pools || []).filter(pool => pool.type === 'department-baseline' || String(pool.ownerDept || pool.name || '').includes('部门基线')), [budget]);
  const summary = useMemo(() => buildBudgetSourceSummary(sourceRows, baselinePools), [sourceRows, baselinePools]);
  const demandPoolRows = useMemo(() => demandPools.map(pool => ({ ...pool, ...(poolRows.find(row => row.id === pool.id) || {}) })), [demandPools, poolRows]);
  const baselinePoolRows = useMemo(() => baselinePools.map(pool => ({ ...pool, ...(poolRows.find(row => row.id === pool.id) || {}) })), [baselinePools, poolRows]);
  const demandPoolAmount = demandPoolRows.reduce((s, r) => s + getBudgetPoolAmount(r), 0);
  const demandPoolOccupied = demandPoolRows.reduce((s, r) => s + toNumber(r.demandBudget), 0);
  const baselinePoolOccupied = baselinePoolRows.reduce((s, r) => s + toNumber(r.demandBudget), 0);
  const totalPoolAmount = demandPoolAmount + summary.baselineAmount;
  const totalOccupied = demandPoolOccupied + baselinePoolOccupied;
  const fmt = value => Number(value || 0).toFixed(1);
  const updatePools = updater => setBudget(current => ({ ...current, pools: updater(Array.isArray(current.pools) ? current.pools : []) }));
  const updatePool = (id, key, value) => updatePools(pools => pools.map(pool => pool.id === id ? { ...pool, [key]: key === 'amount' ? Math.max(0, toNumber(value)) : value } : pool));
  const addDemandPool = () => updatePools(pools => [...pools, { id: `pool-demand-${Date.now()}`, name: '需求方预算池', ownerDept: '', type: 'demand-side', month: '', amount: 0, description: '需求方提供预算' }]);
  const addBaselinePool = () => updatePools(pools => [...pools, { id: `pool-baseline-${Date.now()}`, name: '部门基线预算池', ownerDept: '部门基线（OBP/存量/差评等）', type: 'department-baseline', month: '', amount: 0, description: '部门基线预算' }]);
  const deletePool = id => updatePools(pools => pools.filter(pool => pool.id !== id));
  const statusClass = status => ['已超额', '无预算池'].includes(status) ? 'risk-high' : ['接近用尽', '已用尽'].includes(status) ? 'risk-medium' : 'risk-low';
  const renderPoolRows = (rows, editableType) => rows.length ? rows.map(row => <tr key={row.id}>
    <td><input value={row.name || ''} onChange={e=>updatePool(row.id,'name',e.target.value)}/></td>
    <td><input value={row.ownerDept || ''} onChange={e=>updatePool(row.id,'ownerDept',e.target.value)}/></td>
    <td>{budgetPoolTypeLabels[row.type] || row.type}</td>
    <td><input type="month" value={row.month || ''} onChange={e=>updatePool(row.id,'month',e.target.value)}/></td>
    <td><input type="number" min="0" value={row.amount || 0} onChange={e=>updatePool(row.id,'amount',e.target.value)}/></td>
    <td>{row.demandCount || 0}</td>
    <td>{fmt(row.demandBudget)}w</td>
    <td>{fmt(row.executionCost)}w</td>
    <td>{fmt((row.amount || 0) - (row.demandBudget || 0))}w</td>
    <td><span className={`risk-badge ${statusClass(row.status || '正常')}`}>{row.status || '正常'}</span></td>
    <td><input value={row.description || ''} onChange={e=>updatePool(row.id,'description',e.target.value)}/></td>
    <td><button className="link" onClick={()=>deletePool(row.id)}>删除</button></td>
  </tr>) : <tr><td colSpan="12">暂无{editableType}预算池。</td></tr>;
  return <div className="budget-exec-dashboard">
    <Header title="预算管理" desc="上方汇总预算来源全貌，下方分别维护需求类预算和部门基线预算，作为预算与风险分析的基础数据来源。"/>
    <section className="budget-exec-layer"><h2>预算概览</h2><div className="kpi-grid"><Kpi label="预算池总额" value={`${fmt(totalPoolAmount)}w`}/><Kpi label="来源于需求的预算" value={`${fmt(demandPoolAmount)}w`} sub={`需求池预算申报 ${fmt(summary.demandBudget)}w`}/><Kpi label="来源于基线的预算" value={`${fmt(summary.baselineAmount)}w`}/><Kpi label="已占用预算" value={`${fmt(totalOccupied)}w`}/><Kpi label="预算剩余" value={`${fmt(totalPoolAmount - totalOccupied)}w`} tone={totalPoolAmount - totalOccupied < 0 ? 'danger' : 'ok'}/></div><div className="kpi-grid four"><Kpi label="需求预算占用" value={`${fmt(demandPoolOccupied)}w`} sub="匹配需求方预算池"/><Kpi label="基线预算占用" value={`${fmt(baselinePoolOccupied)}w`} sub="匹配部门基线预算池"/><Kpi label="无预算需求数" value={`${summary.noBudgetCount} 个`} tone={summary.noBudgetCount>0?'danger':'ok'}/><Kpi label="预算来源数" value={`${summary.sourceCount} 个`}/></div></section>
    <section className="budget-exec-card"><h2>需求池预算来源汇总</h2><p className="muted">来自需求池“需求方/预算金额/预算状态”的申报视角，用于说明需求侧预算来源构成。</p><MiniTable rows={sourceRows.map(r => ({ ...r, demandCountLink: <button className="risk-id-link" onClick={()=>openDemandIds?.(r.demandIds, `预算来源「${r.source}」关联需求`)}>{r.demandCount}</button>, budgetAmountText: `${fmt(r.budgetAmount)}w`, executionCostText: `${fmt(r.executionCost)}w / ${fmt(r.executionDays)}人天`, acquiredText: `${fmt(r.acquired)}w`, committedText: `${fmt(r.committed)}w`, overdueText: `${fmt(r.overdue)}w` }))} cols={[["source","预算来源/需求方"],["demandCountLink","需求数"],["budgetAmountText","需求申报预算"],["executionCostText","执行成本估算"],["acquiredText","已获取"],["committedText","已承诺未获取"],["overdueText","获取超期"],["noBudgetCount","无预算需求数"],["matchedPoolsText","匹配预算池"]]}/></section>
    <section className="budget-exec-card"><div className="toolbar"><h2>需求类预算池</h2><div className="actions"><button onClick={addDemandPool}>新增需求类预算</button></div></div><p className="muted">需求方提供的预算池，通常按制造、审计、供应、财经等需求方维护。需求会按需求方自动匹配并扣减。</p><div className="mini-table"><table><thead><tr>{['预算池名称','所属需求方','类型','月份/年度','预算金额w','匹配需求数','需求预算占用w','执行成本占用w','剩余w','状态','说明','操作'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{renderPoolRows(demandPoolRows, '需求类')}</tbody></table></div></section>
    <section className="budget-exec-card"><div className="toolbar"><h2>基线类预算池</h2><div className="actions"><button onClick={addBaselinePool}>新增基线类预算</button></div></div><p className="muted">部门基线预算包括 OBP、存量运营、差评、零星等基线来源。管理员维护后会实时影响风险判断。</p><div className="mini-table"><table><thead><tr>{['预算池名称','所属部门','类型','月份/年度','预算金额w','匹配需求数','需求预算占用w','执行成本占用w','剩余w','状态','说明','操作'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{renderPoolRows(baselinePoolRows, '基线类')}</tbody></table></div></section>
  </div>;
}

function buildBudgetPoolUsageOption(rows) {
  const topRows = rows.slice(0, 12);
  const colorOf = status => ['已超额', '无预算池'].includes(status) ? '#dc2626' : ['接近用尽', '已用尽'].includes(status) ? '#f97316' : '#16a34a';
  return { tooltip: { trigger: 'axis', valueFormatter: value => `${value}%` }, grid: { left: 150, right: 42, top: 24, bottom: 30 }, xAxis: { type: 'value', name: '%', max: value => Math.max(120, toNumber(value.max)) }, yAxis: { type: 'category', data: topRows.map(r => r.name), inverse: true }, series: [{ type: 'bar', data: topRows.map(r => ({ value: Number.isFinite(r.usageRate) ? Number((r.usageRate * 100).toFixed(1)) : 120, itemStyle: { color: colorOf(r.status) } })), label: { show: true, position: 'right', formatter: p => `${p.value}%` }, markLine: { symbol: 'none', lineStyle: { color: '#344054', type: 'dashed' }, label: { formatter: '100%耗尽线' }, data: [{ xAxis: 100 }] } }] };
}

function buildBudgetPoolStatusOption(rows) {
  const statuses = ['正常', '接近用尽', '已用尽', '已超额', '无预算池'];
  const data = statuses.map(status => ({ name: status, value: rows.filter(r => r.status === status).length })).filter(item => item.value > 0);
  return { color: ['#16a34a', '#f97316', '#fb923c', '#dc2626', '#64748b'], tooltip: { trigger: 'item', formatter: '{b}: {c} 个 ({d}%)' }, legend: { bottom: 0 }, series: [{ type: 'pie', radius: ['42%', '70%'], label: { formatter: '{b}\n{c}个' }, data }] };
}

function buildMonthlyBudgetOccupationOption(rows) {
  const months = rows.map(r => r.month);
  return {
    color: ['#2563eb', '#16a34a', '#f97316', '#dc2626', '#7c3aed'],
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: params => params.map(p => `${p.seriesName}: ${p.seriesName.includes('使用率') ? p.value + '%' : p.value + 'w'}`).join('<br/>') },
    legend: { top: 0 },
    grid: { left: 56, right: 58, top: 42, bottom: 38 },
    xAxis: { type: 'category', data: months },
    yAxis: [{ type: 'value', name: 'w' }, { type: 'value', name: '使用率', axisLabel: { formatter: '{value}%' } }],
    series: [
      { name: '预算池额度', type: 'bar', data: rows.map(r => Number(r.poolAmount.toFixed(1))) },
      { name: '需求预算占用', type: 'bar', data: rows.map(r => Number(r.demandBudget.toFixed(1))) },
      { name: '执行成本占用', type: 'bar', data: rows.map(r => Number(r.executionCost.toFixed(1))) },
      { name: '超额金额', type: 'bar', data: rows.map(r => Number(r.overAmount.toFixed(1))), itemStyle: { color: '#dc2626' } },
      { name: '累计使用率', type: 'line', yAxisIndex: 1, smooth: true, data: rows.map(r => Number((r.cumulativePoolAmount > 0 ? r.cumulativeDemandBudget / r.cumulativePoolAmount * 100 : 0).toFixed(1))), markLine: { symbol: 'none', lineStyle: { color: '#dc2626', type: 'dashed' }, label: { formatter: '100%耗尽线' }, data: [{ yAxis: 100 }] } }
    ]
  };
}


function BudgetRiskAnalysisPage({ demands, budget, setBudget, openDemand, openDemandFilter, openDemandIds }) {
  const safeDemands = Array.isArray(demands) ? demands : [];
  const [activeTab, setActiveTab] = useState('pools');
  const [monthStart, setMonthStart] = useState('');
  const [monthEnd, setMonthEnd] = useState('');
  const [monthKey, setMonthKey] = useState(() => getCurrentMonthKey());
  const [riskLevelFilter, setRiskLevelFilter] = useState('nonLow');
  const [riskCategoryFilter, setRiskCategoryFilter] = useState('全部');
  const [filteredRiskIds, setFilteredRiskIds] = useState(null);
  const [filteredRiskLabel, setFilteredRiskLabel] = useState('');
  const [poolError, setPoolError] = useState('');
  const monthOptions = useMemo(() => buildMonthOptions(safeDemands), [safeDemands]);
  const poolRows = useMemo(() => buildBudgetPoolRows(safeDemands, budget), [safeDemands, budget]);
  const allMonthlyRows = useMemo(() => buildMonthlyBudgetOccupationRows(safeDemands, budget), [safeDemands, budget]);
  const monthlyRows = useMemo(() => allMonthlyRows.filter(row => (row.month === '未计划' || row.month === '年度/长期') ? !monthStart && !monthEnd : (!monthStart || row.month >= monthStart) && (!monthEnd || row.month <= monthEnd)), [allMonthlyRows, monthStart, monthEnd]);
  const demandRows = useMemo(() => buildBudgetOccupationDemandRows(safeDemands, budget), [safeDemands, budget]);
  const summary = useMemo(() => buildBudgetPoolSummary(poolRows, allMonthlyRows), [poolRows, allMonthlyRows]);
  const riskRows = useMemo(() => buildBudgetRiskRows(safeDemands, budget), [safeDemands, budget]);
  const riskDetailRows = riskRows.filter(row => {
    const matchesIds = !filteredRiskIds || filteredRiskIds.includes(row.id);
    const matchesLevel = riskLevelFilter === '全部' ? true : riskLevelFilter === 'nonLow' ? row.riskLevel !== 'low' : row.riskLevel === riskLevelFilter;
    const matchesCategory = riskCategoryFilter === '全部' || row.triggeredRules.some(rule => rule.category === riskCategoryFilter);
    return matchesIds && matchesLevel && matchesCategory;
  });
  const riskSummary = useMemo(() => buildBudgetRiskSummary(riskRows, budget), [riskRows, budget]);
  const executorRows = useMemo(() => buildExecutorExecutionRows(safeDemands, budget, monthKey), [safeDemands, budget, monthKey]);
  const sourceRows = useMemo(() => buildBudgetSourceExecutionRows(safeDemands, budget), [safeDemands, budget]);
  const executionDemandRows = useMemo(() => buildBudgetExecutionDemandRows(safeDemands, budget), [safeDemands, budget]);
  const executionSummary = useMemo(() => buildBudgetExecutionSummary(executorRows, sourceRows), [executorRows, sourceRows]);
  const fmt = value => Number(value || 0).toFixed(1);
  const statusClass = status => ['已超额', '无预算池', '超执行', '无预算执行', '人力超载且预算不足'].includes(status) ? 'risk-high' : ['接近用尽', '已用尽', '接近耗尽', '已耗尽', '人力超载', '预算不足'].includes(status) ? 'risk-medium' : 'risk-low';
  const statusBadge = status => <span className={`risk-badge ${statusClass(status)}`}>{status}</span>;
  const updatePools = updater => setBudget(current => ({ ...current, pools: updater(Array.isArray(current.pools) ? current.pools : []) }));
  const addPool = () => updatePools(pools => [...pools, { id: `pool-${Date.now()}`, name: '新预算池', ownerDept: '', type: 'demand-side', month: '', amount: 0, description: '' }]);
  const updatePool = (id, key, value) => updatePools(pools => pools.map(pool => {
    if (pool.id !== id) return pool;
    if (key === 'amount' && toNumber(value) < 0) { setPoolError('预算金额不能为负数'); return pool; }
    if (key === 'name' && !String(value).trim()) setPoolError('预算池名称不能为空'); else setPoolError('');
    return { ...pool, [key]: key === 'amount' ? Math.max(0, toNumber(value)) : value };
  }));
  const deletePool = id => updatePools(pools => pools.filter(pool => pool.id !== id));
  React.useEffect(() => {
    const handler = event => {
      const { ids, label } = event.detail || {};
      setFilteredRiskIds(Array.isArray(ids) ? ids : []);
      setFilteredRiskLabel(label || '已按预算分析筛选风险需求');
      setActiveTab('risk');
      setRiskLevelFilter('全部');
      setRiskCategoryFilter('全部');
      setTimeout(() => document.querySelector('.risk-detail-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    };
    window.addEventListener('wfp.filterRiskDemandIds', handler);
    return () => window.removeEventListener('wfp.filterRiskDemandIds', handler);
  }, []);
  return <div className="budget-exec-dashboard budget-risk-dashboard">
    <Header title="预算与风险分析" desc="统一维护预算池，按需求预算和执行成本动态扣减，并集中查看月度占用、风险规则和执行分析。"/>
    <div className="tab-bar">{[['pools','预算池总览'],['monthly','月度预算占用'],['details','需求占用明细'],['risk','风险分析'],['execution','执行分析']].map(([key,label]) => <button key={key} className={activeTab===key?'active':''} onClick={()=>setActiveTab(key)}>{label}</button>)}</div>
    {activeTab === 'pools' && <>
      <div className="kpi-grid"><Kpi label="预算池总额" value={`${fmt(summary.totalAmount)}w`}/><Kpi label="需求预算占用" value={`${fmt(summary.demandBudget)}w`}/><Kpi label="执行成本占用" value={`${fmt(summary.executionCost)}w`}/><Kpi label="剩余额度" value={`${fmt(summary.remaining)}w`} tone={summary.remaining<0?'danger':'ok'}/><Kpi label="超额预算池" value={`${summary.overPoolCount} 个`} tone={summary.overPoolCount>0?'danger':'ok'}/></div>
      <div className="budget-exec-chart-grid"><section className="budget-exec-card"><h2>预算池使用率排行</h2><ReactECharts className="budget-exec-chart" option={buildBudgetPoolUsageOption(poolRows)} notMerge lazyUpdate/></section><section className="budget-exec-card"><h2>预算池状态分布</h2><ReactECharts className="budget-exec-chart" option={buildBudgetPoolStatusOption(poolRows)} notMerge lazyUpdate/></section></div>
      <section className="budget-exec-card"><div className="toolbar"><h2>预算池维护与占用结果</h2><div className="actions"><button onClick={addPool}>新增预算池</button></div></div>{poolError && <p className="field-error">{poolError}</p>}<div className="mini-table"><table><thead><tr>{['预算池名称','所属需求方/部门','类型','月份/年度','预算金额w','需求数','需求预算占用w','执行成本占用w','剩余w','使用率','状态','说明','操作'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{(budget.pools || []).map(pool => { const row = poolRows.find(item => item.id === pool.id) || {}; return <tr key={pool.id}><td><input value={pool.name} onChange={e=>updatePool(pool.id,'name',e.target.value)}/></td><td><input value={pool.ownerDept} onChange={e=>updatePool(pool.id,'ownerDept',e.target.value)}/></td><td><select value={pool.type} onChange={e=>updatePool(pool.id,'type',e.target.value)}>{budgetPoolTypes.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></td><td><input type="month" value={pool.month || ''} onChange={e=>updatePool(pool.id,'month',e.target.value)}/></td><td><input type="number" min="0" value={pool.amount} onChange={e=>updatePool(pool.id,'amount',e.target.value)}/></td><td>{row.demandCount || 0}</td><td>{fmt(row.demandBudget)}w</td><td>{fmt(row.executionCost)}w</td><td>{fmt(row.remaining)}w</td><td>{Number.isFinite(row.usageRate) ? `${(row.usageRate * 100).toFixed(1)}%` : '无预算'}</td><td>{statusBadge(row.status || '正常')}</td><td><input value={pool.description || ''} onChange={e=>updatePool(pool.id,'description',e.target.value)}/></td><td><button className="link" onClick={()=>deletePool(pool.id)}>删除</button></td></tr>; })}{poolRows.filter(row => row.id === '__unmatched__').map(row => <tr key={row.id}><td>{row.name}</td><td>{row.ownerDept}</td><td>{row.typeLabel}</td><td>{row.month}</td><td>{fmt(row.amount)}w</td><td>{row.demandCount}</td><td>{fmt(row.demandBudget)}w</td><td>{fmt(row.executionCost)}w</td><td>{fmt(row.remaining)}w</td><td>无预算</td><td>{statusBadge(row.status)}</td><td>{row.description}</td><td>-</td></tr>)}</tbody></table></div></section>
    </>}
    {activeTab === 'monthly' && <><div className="toolbar"><div className="actions"><span className="month-filter-label">占用月份：</span><label className="month-filter-control"><span>开始月份</span><MonthSelect value={monthStart} onChange={setMonthStart} options={monthOptions}/></label><label className="month-filter-control"><span>结束月份</span><MonthSelect value={monthEnd} onChange={setMonthEnd} options={monthOptions}/></label></div></div><section className="budget-exec-card"><h2>月度预算占用趋势</h2><ReactECharts className="budget-exec-chart" option={buildMonthlyBudgetOccupationOption(monthlyRows)} notMerge lazyUpdate/></section><section className="budget-exec-card"><h2>月度预算占用汇总</h2><MiniTable rows={monthlyRows.map(r => ({ ...r, poolAmountText: `${fmt(r.poolAmount)}w`, demandBudgetText: `${fmt(r.demandBudget)}w`, executionCostText: `${fmt(r.executionCost)}w`, cumulativeDemandBudgetText: `${fmt(r.cumulativeDemandBudget)}w`, cumulativeExecutionCostText: `${fmt(r.cumulativeExecutionCost)}w`, remainingText: `${fmt(r.remaining)}w`, overAmountText: `${fmt(r.overAmount)}w`, statusBadge: statusBadge(r.status) }))} cols={[["month","月份"],["poolAmountText","当月预算池额度"],["demandBudgetText","当月需求预算占用"],["executionCostText","当月执行成本占用"],["cumulativeDemandBudgetText","累计需求预算占用"],["cumulativeExecutionCostText","累计执行成本占用"],["remainingText","剩余额度"],["overAmountText","超额金额"],["demandCount","涉及需求数"],["statusBadge","结论"]]}/></section></>}
    {activeTab === 'details' && <section className="budget-exec-card"><h2>需求占用明细</h2><MiniTable rows={demandRows.map(r => ({ ...r, demandLink: <button className="risk-id-link" onClick={()=>openDemand(r.id)}>{r.demandId}</button>, budgetAmountText: `${fmt(r.budgetAmount)}w`, executionCostText: `${fmt(r.executionCost)}w`, poolStatusBadge: statusBadge(r.poolStatus), budgetInsufficientText: r.budgetInsufficient ? '是' : '否' }))} cols={[["demandLink","需求ID"],["title","名称"],["source","类型"],["investment","需求方"],["budgetPoolName","匹配预算池"],["budgetAmountText","预算金额"],["executionCostText","执行成本"],["budgetStatusLabel","预算状态"],["occupationMonth","占用月份"],["demandBA","需求BA"],["demandPM","需求PM"],["status","需求状态"],["poolStatusBadge","预算池状态"],["budgetInsufficientText","是否超额"]]}/></section>}
    {activeTab === 'risk' && <><div className="toolbar"><div className="actions"><span className="muted">预算池和需求池变化会实时重算风险。</span></div><div className="actions"><button onClick={()=>downloadBudgetRiskCsv(riskDetailRows)}>导出</button></div></div>{filteredRiskIds && <div className="notice">{filteredRiskLabel}：当前展示 {riskDetailRows.length} 条风险需求 <button className="link neutral" onClick={()=>{ setFilteredRiskIds(null); setFilteredRiskLabel(''); setRiskLevelFilter('nonLow'); }}>清除筛选</button></div>}<section className="risk-layer"><h2>整体风险</h2><div className="kpi-grid four"><Kpi label="高风险需求" value={`${riskSummary.highRiskCount} 个`} tone={riskSummary.highRiskCount>0?'danger':'ok'}/><Kpi label="中风险需求" value={`${riskSummary.mediumRiskCount} 个`} tone={riskSummary.mediumRiskCount>0?'danger':'ok'}/><Kpi label="风险人天" value={`${riskSummary.gapDays} 人天`} tone={riskSummary.gapDays>0?'danger':'ok'}/><Kpi label="预算金额缺口" value={`${riskSummary.amountGap.toFixed(1)}w`} tone={riskSummary.amountGap>0?'danger':'ok'}/></div><div className="risk-chart-grid"><section className="risk-chart-card"><h2>风险等级分布</h2><ReactECharts className="risk-chart" option={buildRiskLevelOption(riskRows)} notMerge lazyUpdate/></section><section className="risk-chart-card"><h2>风险规则分类分布</h2><ReactECharts className="risk-chart" option={buildRiskCategoryOption(riskRows)} notMerge lazyUpdate/></section><section className="risk-chart-card"><h2>预算状态分布</h2><ReactECharts className="risk-chart" option={buildBudgetDonutOption(riskRows)} notMerge lazyUpdate/></section><section className="risk-chart-card"><h2>各状态人力投入与预算覆盖</h2><ReactECharts className="risk-chart" option={buildStatusBudgetOption(riskRows)} notMerge lazyUpdate/></section></div></section><section className="risk-table-card"><div className="toolbar"><h2>预算风险明细表</h2><div className="risk-filter-tags"><button className={riskLevelFilter==='nonLow'?'active':''} onClick={()=>setRiskLevelFilter('nonLow')}>中高风险</button><button className={riskLevelFilter==='high'?'active':''} onClick={()=>setRiskLevelFilter('high')}>高风险</button><button className={riskLevelFilter==='medium'?'active':''} onClick={()=>setRiskLevelFilter('medium')}>中风险</button><button className={riskLevelFilter==='low'?'active':''} onClick={()=>setRiskLevelFilter('low')}>低风险</button><button className={riskLevelFilter==='全部'?'active':''} onClick={()=>setRiskLevelFilter('全部')}>全部等级</button>{['全部', ...new Set(riskRules.map(rule => rule.category))].map(category => <button key={category} className={riskCategoryFilter===category?'active':''} onClick={()=>setRiskCategoryFilter(category)}>{category}</button>)}</div></div><div className="mini-table risk-detail-table"><table><thead><tr><th>需求ID</th><th>名称</th><th>状态</th><th>计划落地</th><th>人力</th><th>预算池</th><th>预算池剩余</th><th>风险等级</th><th>命中规则</th><th>建议操作</th></tr></thead><tbody>{riskDetailRows.map(row => <tr key={row.id} className={`risk-row-${row.riskLevel}`}><td><button className="risk-id-link" onClick={()=>openDemand(row.id)}>{row.demandNo || row.rr || row.id}</button></td><td>{row.title}</td><td>{row.status}</td><td>{row.landingDate || '未排期'}</td><td>{row.days}</td><td>{row.budgetPoolName}</td><td>{fmt(row.poolRemaining)}w</td><td><span className={`risk-badge risk-${row.riskLevel}`}>{row.riskText}</span></td><td className="risk-reason-cell">{row.triggeredRules.map(rule => rule.name).join('；')}</td><td className="risk-reason-cell">{row.action}</td></tr>)}</tbody></table></div></section><RiskRulesPage rows={riskRows} openDemandIds={openDemandIds}/></>}
    {activeTab === 'execution' && <><div className="toolbar"><div className="actions"><input type="month" value={monthKey} onChange={e=>setMonthKey(e.target.value)}/></div><div className="actions"><button onClick={()=>downloadBudgetExecutionCsv(executorRows, sourceRows, executionDemandRows)}>导出</button></div></div><div className="kpi-grid"><Kpi label="当月执行人天" value={`${fmt(executionSummary.monthlyExecutionDays)} 人天`}/><Kpi label="超饱和需求PM数" value={`${executionSummary.overloadedExecutors} 人`} tone={executionSummary.overloadedExecutors>0?'danger':'ok'}/><Kpi label="预算池总额" value={`${fmt(executionSummary.budgetAmount)}w`}/><Kpi label="执行/占用预算" value={`${fmt(executionSummary.occupiedCost)}w`}/><Kpi label="超执行预算池数" value={`${executionSummary.overBudgetSources} 个`} tone={executionSummary.overBudgetSources>0?'danger':'ok'}/></div><section className="budget-exec-layer"><h2>当月PM饱和与预算支撑</h2><section className="budget-exec-card"><h2>当月需求PM饱和度</h2>{executorRows.length ? <ReactECharts className="budget-exec-chart" option={buildExecutorSaturationOption(executorRows, budget)} notMerge lazyUpdate/> : <p className="empty">当前月份暂无已排期需求</p>}</section><section className="budget-exec-card"><h2>需求PM明细</h2><MiniTable rows={executorRows.map(r => ({ ...r, executionDays: fmt(r.executionDays), saturationText: `${(r.saturation*100).toFixed(1)}%`, estimatedCost: `${fmt(r.estimatedCost)}w`, supportRateText: `${(r.supportRate*100).toFixed(1)}%`, conclusionBadge: statusBadge(r.conclusion) }))} cols={[["demandPM","需求PM"],["demandCount","当月需求数"],["executionDays","执行人天"],["saturationText","饱和度"],["estimatedCost","估算成本"],["supportRateText","预算支撑率"],["conclusionBadge","结论"]]}/></section></section><section className="budget-exec-layer"><h2>预算池/需求方执行占用</h2><div className="budget-exec-chart-grid"><section className="budget-exec-card"><h2>预算池执行占用</h2><ReactECharts className="budget-exec-chart" option={buildBudgetSourceExecutionOption(sourceRows)} notMerge lazyUpdate/></section><section className="budget-exec-card"><h2>预算执行率排行</h2><ReactECharts className="budget-exec-chart" option={buildBudgetExecutionRateOption(sourceRows)} notMerge lazyUpdate/></section></div><section className="budget-exec-card"><h2>预算池/需求方明细</h2><MiniTable rows={sourceRows.map(r => ({ ...r, demandCountLink: <button className="risk-id-link" onClick={()=>openDemandIds?.(r.demandIds || [], `预算池「${r.source}」关联需求`)}>{r.demandCount}</button>, budgetAmount: `${fmt(r.budgetAmount)}w`, totalExecutionCost: `${fmt(r.totalExecutionCost)}w`, remaining: `${fmt(r.remaining)}w`, executionRateText: Number.isFinite(r.executionRate) ? `${(r.executionRate*100).toFixed(1)}%` : '无预算', statusBadge: statusBadge(r.status) }))} cols={[["source","预算池/需求方"],["demandCountLink","需求数"],["budgetAmount","预算额度"],["totalExecutionCost","执行占用合计"],["remaining","剩余额度"],["executionRateText","执行率"],["noBudgetCount","无预算需求数"],["overBudgetDemandCount","单需求超预算数"],["statusBadge","状态"]]}/></section></section><section className="budget-exec-card"><h2>需求与预算池映射明细</h2><MiniTable rows={executionDemandRows.map(r => ({ ...r, demandLink: <button className="risk-id-link" onClick={()=>openDemand(r.id)}>{r.demandId}</button>, budgetAmount: `${fmt(r.budgetAmount)}w`, executionCost: `${fmt(r.executionCost)}w`, budgetInsufficientText: r.budgetInsufficient ? '是' : '否' }))} cols={[["demandLink","需求ID"],["title","名称"],["demandBA","需求BA"],["demandPM","需求PM"],["budgetSource","预算池/需求方"],["status","状态"],["executionStage","执行阶段"],["month","计划落地月份"],["executionDays","预算执行人天"],["budgetAmount","预算金额"],["executionCost","执行成本"],["budgetStatusLabel","预算状态"],["budgetInsufficientText","是否预算不足"]]}/></section></>}
  </div>;
}

function BudgetRiskDashboard({demands, budget, openDemand, openDemandIds}) {
  const [refreshedAt, setRefreshedAt] = useState(() => new Date());
  const [riskTab, setRiskTab] = useState('dashboard');
  const currentYear = new Date().getFullYear();
  const [monthStart, setMonthStart] = useState(`${currentYear}-01`);
  const [monthEnd, setMonthEnd] = useState(`${currentYear}-12`);
  const [riskLevelFilter, setRiskLevelFilter] = useState('nonLow');
  const [riskCategoryFilter, setRiskCategoryFilter] = useState('全部');
  const [filteredRiskIds, setFilteredRiskIds] = useState(null);
  const [filteredRiskLabel, setFilteredRiskLabel] = useState('');
  const monthOptions = useMemo(() => buildMonthOptions(demands), [demands]);
  const monthFilteredDemands = useMemo(() => demands.filter(d => {
    const month = d.landingDate ? String(d.landingDate).slice(0, 7) : '';
    if (!month) return !monthStart && !monthEnd;
    return (!monthStart || month >= monthStart) && (!monthEnd || month <= monthEnd);
  }), [demands, monthStart, monthEnd]);
  const rows = useMemo(() => buildBudgetRiskRows(monthFilteredDemands, budget), [monthFilteredDemands, budget]);
  const riskDetailRows = rows.filter(row => {
    const matchesIds = !filteredRiskIds || filteredRiskIds.includes(row.id);
    const matchesLevel = riskLevelFilter === '全部' ? true : riskLevelFilter === 'nonLow' ? row.riskLevel !== 'low' : row.riskLevel === riskLevelFilter;
    const matchesCategory = riskCategoryFilter === '全部' || row.triggeredRules.some(rule => rule.category === riskCategoryFilter);
    return matchesIds && matchesLevel && matchesCategory;
  });
  const summary = useMemo(() => buildBudgetRiskSummary(rows, budget), [rows, budget]);
  React.useEffect(() => {
    const handler = event => {
      const { ids, label } = event.detail || {};
      setFilteredRiskIds(Array.isArray(ids) ? ids : []);
      setFilteredRiskLabel(label || '已按预算分析筛选风险需求');
      setRiskTab('dashboard');
      setRiskLevelFilter('全部');
      setRiskCategoryFilter('全部');
      setMonthStart('');
      setMonthEnd('');
      setTimeout(() => document.querySelector('.risk-detail-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    };
    window.addEventListener('wfp.filterRiskDemandIds', handler);
    return () => window.removeEventListener('wfp.filterRiskDemandIds', handler);
  }, []);
  const keepScroll = updater => {
    const top = window.scrollY;
    const left = window.scrollX;
    updater();
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top, left, behavior: 'auto' })));
  };
  return <div className="budget-risk-dashboard">
    <Header title="风险看板" desc="直接基于需求池、预算配置和状态字段生成预算覆盖、规则命中与风险明细。"/>
    <div className="tab-bar"><button className={riskTab === 'dashboard' ? 'active' : ''} onClick={()=>setRiskTab('dashboard')}>风险看板</button><button className={riskTab === 'rules' ? 'active' : ''} onClick={()=>setRiskTab('rules')}>风险规则</button></div>
    <div className="toolbar">
      <div className="actions"><span className="month-filter-label">计划落地月份：</span><label className="month-filter-control"><span>开始月份</span><MonthSelect value={monthStart} onChange={setMonthStart} options={monthOptions}/></label><label className="month-filter-control"><span>结束月份</span><MonthSelect value={monthEnd} onChange={setMonthEnd} options={monthOptions}/></label><span className="muted">刷新时间：{refreshedAt.toLocaleString()}</span></div>
      <div className="actions"><button onClick={()=>setRefreshedAt(new Date())}>刷新</button><button onClick={()=>downloadBudgetRiskCsv(riskDetailRows)}>导出</button></div>
    </div>
    {filteredRiskIds && <div className="notice">{filteredRiskLabel}：当前展示 {riskDetailRows.length} 条风险需求 <button className="link neutral" onClick={()=>{ setFilteredRiskIds(null); setFilteredRiskLabel(''); setRiskLevelFilter('nonLow'); }}>清除筛选</button></div>}
    {riskTab === 'rules' ? <RiskRulesPage rows={rows} openDemandIds={openDemandIds}/> : <>
      <section className="risk-layer"><h2>整体风险</h2><div className="kpi-grid four"><Kpi label="高风险需求" value={`${summary.highRiskCount} 个`} tone={summary.highRiskCount>0?'danger':'ok'}/><Kpi label="中风险需求" value={`${summary.mediumRiskCount} 个`} tone={summary.mediumRiskCount>0?'danger':'ok'}/><Kpi label="风险人天" value={`${summary.gapDays} 人天`} tone={summary.gapDays>0?'danger':'ok'}/><Kpi label="预算金额缺口" value={`${summary.amountGap.toFixed(1)}w`} tone={summary.amountGap>0?'danger':'ok'} sub="已消耗 + 需求成本估算 - 全年预算"/></div><div className="kpi-grid four"><Kpi label="需求成本估算" value={`${summary.estimatedCost.toFixed(1)}w`} sub={`${getBudgetDayCost(budget)}w/人天`}/><Kpi label="需求预算金额" value={`${summary.demandBudget.toFixed(1)}w`}/><Kpi label="需求预算缺口" value={`${summary.budgetGap.toFixed(1)}w`} tone={summary.budgetGap>0?'danger':'ok'}/><Kpi label="需求总数" value={`${summary.totalCount} 个`}/></div><section className="risk-chart-card"><h2>整体预算缺口分析</h2><ReactECharts className="risk-chart" option={buildBudgetGapOption(rows, budget)} notMerge lazyUpdate/></section></section>
      <section className="risk-layer"><h2>风险分布</h2><div className="risk-chart-grid"><section className="risk-chart-card"><h2>风险等级分布</h2><ReactECharts className="risk-chart" option={buildRiskLevelOption(rows)} notMerge lazyUpdate/></section><section className="risk-chart-card"><h2>风险规则分类分布</h2><ReactECharts className="risk-chart" option={buildRiskCategoryOption(rows)} notMerge lazyUpdate/></section><section className="risk-chart-card"><h2>预算状态分布（需求数 vs 人力）</h2><ReactECharts className="risk-chart" option={buildBudgetDonutOption(rows)} notMerge lazyUpdate/></section><section className="risk-chart-card"><h2>月度风险趋势 / 按计划落地月份分布</h2><p className="muted">当前无历史快照，趋势按计划落地月份分布。</p><ReactECharts className="risk-chart" option={buildBudgetTrendOption(rows)} notMerge lazyUpdate/></section><section className="risk-chart-card"><h2>各状态人力投入与预算覆盖</h2><ReactECharts className="risk-chart" option={buildStatusBudgetOption(rows)} notMerge lazyUpdate/></section></div></section>
      <section className="risk-layer"><h2>风险明细</h2><section className="risk-table-card"><div className="toolbar"><h2>预算风险明细表</h2><div className="risk-filter-tags"><button className={riskLevelFilter==='nonLow'?'active':''} onClick={()=>keepScroll(()=>setRiskLevelFilter('nonLow'))}>中高风险</button><button className={riskLevelFilter==='high'?'active':''} onClick={()=>keepScroll(()=>setRiskLevelFilter('high'))}>高风险</button><button className={riskLevelFilter==='medium'?'active':''} onClick={()=>keepScroll(()=>setRiskLevelFilter('medium'))}>中风险</button><button className={riskLevelFilter==='low'?'active':''} onClick={()=>keepScroll(()=>setRiskLevelFilter('low'))}>低风险</button><button className={riskLevelFilter==='全部'?'active':''} onClick={()=>keepScroll(()=>setRiskLevelFilter('全部'))}>全部等级</button>{['全部', ...new Set(riskRules.map(rule => rule.category))].map(category => <button key={category} className={riskCategoryFilter===category?'active':''} onClick={()=>keepScroll(()=>setRiskCategoryFilter(category))}>{category}</button>)}</div></div><div className="mini-table risk-detail-table"><table><thead><tr><th>需求ID</th><th>名称</th><th>状态</th><th>计划落地</th><th>距落地天数</th><th>人力</th><th>预算状态</th><th>风险等级</th><th>命中规则</th><th>建议操作</th></tr></thead><tbody>{riskDetailRows.map(row => <tr key={row.id} className={`risk-row-${row.riskLevel}`}><td><button className="risk-id-link" onClick={()=>openDemand(row.id)}>{row.demandNo || row.rr || row.id}</button></td><td>{row.title}</td><td>{row.status}</td><td>{row.landingDate || '未排期'}</td><td>{Number.isFinite(row.daysToLanding) ? row.daysToLanding : '未排期'}</td><td>{row.days}</td><td>{row.budgetStatusLabel}</td><td><span className={`risk-badge risk-${row.riskLevel}`}>{row.riskText}</span></td><td className="risk-reason-cell">{row.triggeredRules.map(rule => rule.name).join('；')}</td><td className="risk-reason-cell">{row.action}</td></tr>)}</tbody></table></div></section></section>
    </>}
  </div>;
}

function BudgetExecutionAnalysis({ demands, budget, openDemand, openDemandFilter }) {
  const safeDemands = Array.isArray(demands) ? demands : [];
  const [monthKey, setMonthKey] = useState(() => getCurrentMonthKey());
  const [refreshedAt, setRefreshedAt] = useState(() => new Date());
  const executorRows = useMemo(() => buildExecutorExecutionRows(safeDemands, budget, monthKey), [safeDemands, budget, monthKey]);
  const sourceRows = useMemo(() => buildBudgetSourceExecutionRows(safeDemands, budget), [safeDemands, budget]);
  const demandRows = useMemo(() => buildBudgetExecutionDemandRows(safeDemands, budget), [safeDemands, budget]);
  const summary = useMemo(() => buildBudgetExecutionSummary(executorRows, sourceRows), [executorRows, sourceRows]);
  const fmt = value => Number(value || 0).toFixed(1);
  const statusClass = status => ['超执行', '无预算执行', '人力超载且预算不足'].includes(status) ? 'risk-high' : ['接近耗尽', '已耗尽', '人力超载', '预算不足'].includes(status) ? 'risk-medium' : 'risk-low';
  return <div className="budget-exec-dashboard">
    <Header title="预算执行分析" desc="按需求PM饱和度、预算来源执行率和需求执行口径，评估预算是否支撑已排期及后续需求。"/>
    <div className="toolbar"><div className="actions"><input type="month" value={monthKey} onChange={e=>setMonthKey(e.target.value)}/><span className="muted">刷新时间：{refreshedAt.toLocaleString()}</span></div><div className="actions"><button onClick={()=>setRefreshedAt(new Date())}>刷新</button><button onClick={()=>downloadBudgetExecutionCsv(executorRows, sourceRows, demandRows)}>导出</button></div></div>
    <div className="kpi-grid"><Kpi label="当月执行人天" value={`${fmt(summary.monthlyExecutionDays)} 人天`}/><Kpi label="超饱和需求PM数" value={`${summary.overloadedExecutors} 人`} tone={summary.overloadedExecutors>0?'danger':'ok'}/><Kpi label="预算来源总额" value={`${fmt(summary.budgetAmount)}w`}/><Kpi label="执行/占用预算" value={`${fmt(summary.occupiedCost)}w`}/><Kpi label="超执行来源数" value={`${summary.overBudgetSources} 个`} tone={summary.overBudgetSources>0?'danger':'ok'}/></div>
    <div className="kpi-grid four"><Kpi label="预算剩余额度" value={`${fmt(summary.remaining)}w`} tone={summary.remaining<0?'danger':'ok'}/><Kpi label="饱和线" value={`${getMonthlyCapacityDays(budget)} 人天/月`}/><Kpi label="预算换算口径" value={`${getBudgetDayCost(budget)}w/人天`}/><Kpi label="统计月份" value={monthKey}/></div>
    <p className="finance-note">说明：预算来源按需求方/投资来源汇总；执行人天优先使用决算人力，其次结算人力，最后预估人天。</p>
    <section className="budget-exec-layer"><h2>当月PM饱和与预算支撑</h2><section className="budget-exec-card"><h2>当月需求PM饱和度</h2>{executorRows.length ? <ReactECharts className="budget-exec-chart" option={buildExecutorSaturationOption(executorRows, budget)} notMerge lazyUpdate/> : <p className="empty">当前月份暂无已排期需求</p>}</section><section className="budget-exec-card"><h2>需求PM明细</h2><MiniTable rows={executorRows.map(r => ({ ...r, executionDays: fmt(r.executionDays), saturationText: `${(r.saturation*100).toFixed(1)}%`, settledDays: fmt(r.settledDays), acquiredDays: fmt(r.acquiredDays), committedDays: fmt(r.committedDays), unfundedDays: fmt(r.unfundedDays), estimatedCost: `${fmt(r.estimatedCost)}w`, supportRateText: `${(r.supportRate*100).toFixed(1)}%`, conclusionBadge: <span className={`risk-badge ${statusClass(r.conclusion)}`}>{r.conclusion}</span> }))} cols={[["demandPM","需求PM"],["demandCount","当月需求数"],["executionDays","执行人天"],["saturationText","饱和度"],["settledDays","已结算人天"],["acquiredDays","已获取预算人天"],["committedDays","已承诺未获取人天"],["unfundedDays","无预算人天"],["estimatedCost","估算成本"],["supportRateText","预算支撑率"],["conclusionBadge","结论"]]}/></section></section>
    <section className="budget-exec-layer"><h2>预算来源执行情况</h2><div className="budget-exec-chart-grid"><section className="budget-exec-card"><h2>预算来源执行占用</h2><ReactECharts className="budget-exec-chart" option={buildBudgetSourceExecutionOption(sourceRows)} notMerge lazyUpdate/></section><section className="budget-exec-card"><h2>预算执行率排行</h2><ReactECharts className="budget-exec-chart" option={buildBudgetExecutionRateOption(sourceRows)} notMerge lazyUpdate/></section></div><section className="budget-exec-card"><h2>预算来源明细</h2><MiniTable rows={sourceRows.map(r => ({ ...r, demandCountLink: <button className="risk-id-link" onClick={()=>openDemandFilter?.('investment', r.source)}>{r.demandCount}</button>, budgetAmount: `${fmt(r.budgetAmount)}w`, executedCost: `${fmt(r.executedCost)}w / ${fmt(r.executedDays)}人天`, scheduledCost: `${fmt(r.scheduledCost)}w / ${fmt(r.scheduledDays)}人天`, laterCost: `${fmt(r.laterCost)}w / ${fmt(r.laterDays)}人天`, totalExecutionCost: `${fmt(r.totalExecutionCost)}w`, remaining: `${fmt(r.remaining)}w`, executionRateText: Number.isFinite(r.executionRate) ? `${(r.executionRate*100).toFixed(1)}%` : '无预算', statusBadge: <span className={`risk-badge ${statusClass(r.status)}`}>{r.status}</span> }))} cols={[["source","预算来源"],["demandCountLink","需求数"],["budgetAmount","预算额度"],["executedCost","已执行"],["scheduledCost","已排期/执行中"],["laterCost","后续需求"],["totalExecutionCost","执行占用合计"],["remaining","剩余额度"],["executionRateText","执行率"],["noBudgetCount","无预算需求数"],["overBudgetDemandCount","单需求超预算数"],["statusBadge","状态"]]}/></section></section>
    <section className="budget-exec-layer"><h2>需求与预算来源映射明细</h2><section className="budget-exec-card"><MiniTable rows={demandRows.map(r => ({ ...r, demandLink: <button className="risk-id-link" onClick={()=>openDemand(r.id)}>{r.demandId}</button>, originalDays: fmt(r.originalDays), finalDays: fmt(r.finalDays), settlementDays: fmt(r.settlementDays), executionDays: fmt(r.executionDays), budgetAmount: `${fmt(r.budgetAmount)}w`, executionCost: `${fmt(r.executionCost)}w`, budgetInsufficientText: r.budgetInsufficient ? '是' : '否' }))} cols={[["demandLink","需求ID"],["title","名称"],["demandBA","需求BA"],["demandPM","需求PM"],["budgetSource","预算来源"],["status","状态"],["executionStage","执行阶段"],["month","计划落地月份"],["originalDays","原预估人天"],["finalDays","决算人力"],["settlementDays","结算人力"],["executionDays","预算执行人天"],["budgetAmount","预算金额"],["executionCost","执行成本"],["budgetStatusLabel","预算状态"],["budgetContact","预算接口人"],["budgetInsufficientText","是否预算不足"]]}/></section></section>
  </div>;
}

function RiskRulesPage({ rows, openDemandIds }) {
  const [sort, setSort] = useState({ key: '', direction: 'asc' });
  const hitRowsByRule = rows.reduce((matches, row) => {
    row.triggeredRules.forEach(rule => matches.set(rule.id, [...(matches.get(rule.id) || []), row]));
    return matches;
  }, new Map());
  const ruleRows = riskRules.map(rule => ({ ...rule, levelText: riskLevelMeta[rule.level].text, hitCount: (hitRowsByRule.get(rule.id) || []).length }));
  const sortedRules = useMemo(() => sortRows(ruleRows, sort), [ruleRows, sort]);
  const th = (key, label) => <th><button className="table-sort-trigger" onClick={()=>setSort(current=>toggleSort(current, key))}>{label}<span className="sort-indicator">{sort.key === key ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span></button></th>;
  return <section className="risk-table-card"><h2>风险规则清单</h2><div className="mini-table"><table><thead><tr>{th('id','规则ID')}{th('name','规则名称')}{th('levelText','风险等级')}{th('category','规则分类')}{th('description','判断逻辑说明')}{th('action','建议操作')}{th('hitCount','当前命中需求数')}</tr></thead><tbody>{sortedRules.map(rule => { const matchedRows = hitRowsByRule.get(rule.id) || []; return <tr key={rule.id}><td>{rule.id}</td><td>{rule.name}</td><td><span className={`risk-badge risk-${rule.level}`}>{riskLevelMeta[rule.level].text}</span></td><td>{rule.category}</td><td className="risk-reason-cell">{rule.description}</td><td className="risk-reason-cell">{rule.action}</td><td>{matchedRows.length ? <button className="risk-id-link" onClick={()=>openDemandIds?.(matchedRows.map(row => row.id), `风险规则「${rule.name}」命中需求`)}>{matchedRows.length}</button> : 0}</td></tr>; })}</tbody></table></div></section>;
}

function Budget({demands, openBudgetRiskIds}) {
  const monthRows = useMemo(() => buildMonthlyBudgetCadenceRows(demands), [demands]);
  const demandRows = useMemo(() => buildBudgetPlanDemandRows(demands), [demands]);
  const totalBudget = demandRows.reduce((s, r) => s + r.budgetAmount, 0);
  const acquiredBudget = demandRows.filter(r => r.budgetStatusLabel === '已获取').reduce((s, r) => s + r.budgetAmount, 0);
  const committedBudget = demandRows.filter(r => ['已承诺未获取', '获取超期'].includes(r.budgetStatusLabel)).reduce((s, r) => s + r.budgetAmount, 0);
  const riskDemandRows = demandRows.filter(r => ['无预算', '获取超期'].includes(r.budgetStatusLabel));
  const currentMonth = getCurrentMonthKey();
  const future3Budget = monthRows.filter(r => r.month !== '未计划' && r.month >= currentMonth).slice(0, 3).reduce((s, r) => s + r.acquired + r.committed + r.overdue, 0);
  return <div className="budget-exec-dashboard">
    <Header title="预算分析" desc="基于需求池预算计划，查看预算获取月份节奏和预算状态分布。"/>
    <div className="kpi-grid"><Kpi label="预算计划总额" value={formatBudgetMoney(totalBudget)}/><Kpi label="已获取预算金额" value={formatBudgetMoney(acquiredBudget)} tone="ok"/><Kpi label="已承诺未获取金额" value={formatBudgetMoney(committedBudget)} tone={committedBudget>0?'danger':''}/><Kpi label="风险需求数" value={<button className="kpi-link" onClick={()=>openBudgetRiskIds?.(riskDemandRows.map(r => r.id), '预算分析风险需求')}>{riskDemandRows.length} 个</button>} tone={riskDemandRows.length>0?'danger':'ok'} sub="无预算 + 获取超期"/><Kpi label="未来3个月计划获取" value={formatBudgetMoney(future3Budget)}/></div>
    <section className="budget-exec-layer"><h2>月度预算获取节奏</h2><div className="budget-exec-card"><h2>每月预算金额节奏</h2><ReactECharts option={buildBudgetCadenceOption(monthRows)} className="budget-exec-chart"/></div><div className="budget-exec-card"><h2>月度节奏汇总</h2><MiniTable rows={monthRows.map(r => ({ ...r, budgetAmountText: formatBudgetMoney(r.budgetAmount), acquiredText: formatBudgetMoney(r.acquired), committedText: formatBudgetMoney(r.committed), overdueText: formatBudgetMoney(r.overdue) }))} cols={[[ 'month','月份'],['demandCount','需求数'],['budgetAmountText','预算金额'],['acquiredText','已获取'],['committedText','已承诺'],['overdueText','获取超期'],['noBudget','无预算'],['requestersText','涉及需求方'],['pmsText','涉及PM']]}/></div></section>
  </div>;
}

function Analysis({budget, personnel, demands, results}) {
  const totalDays = demands.reduce((s,d)=>s+toNumber(d.days),0);
  const unfunded = demands.filter(d=>!hasBudget(d)).reduce((s,d)=>s+toNumber(d.days),0);
  return <><Header title="分析报告" desc="面向管理决策推演：基于不同新增预算场景，给出需求保留、延期和削减建议。实时风险监控请查看风险看板。"/><div className="kpi-grid four"><Kpi label="需求总量" value={`${totalDays} 人天`}/><Kpi label="无预算需求" value={`${unfunded} 人天`}/><Kpi label="预算换算口径" value={`${getBudgetDayCost(budget)}w/人天`}/><Kpi label="预算结余" value={`${budget.annualBudget-budget.consumedCost}w`} tone={budget.annualBudget-budget.consumedCost<0?'danger':'ok'}/></div><section className="card"><h2>人员管理</h2><p className="muted">人员管理按人员姓名、工号、负责人、岗位、地点、供应商、入项时间和元/人天成本维护。</p><MiniTable rows={personnel} cols={[['name','人员姓名'],['employeeNo','工号'],['owner','负责人'],['position','岗位'],['location','地点'],['supplier','供应商'],['entryDate','入项时间'],['dailyCost','人天成本（元/人天）'],['monthlyDays','月度可用人天']]}/></section><section className="card"><h2>投入分布</h2><div className="three">{['investment','source'].map((f,i)=><div key={f}><h3>{['按需求方','按类型'][i]}</h3>{groupSum(demands,f).map(([k,v])=><div className="bar" key={k}><span>{k}</span><b>{v}</b></div>)}</div>)}</div></section>{results.map(r=><section className="card scenario-detail" key={r.name}><h2>{r.name}</h2><div className="kpi-grid four"><Kpi label="新增预算" value={`${r.addedBudget}w`}/><Kpi label="抵扣后可用" value={`${r.nextMonthBudget.toFixed(1)}w`}/><Kpi label="可支撑" value={`${r.supportedDays.toFixed(1)} 人天`}/><Kpi label="需减少/延后" value={`${r.reductionNeeded.toFixed(1)} 人天`} tone={r.reductionNeeded>0?'danger':'ok'}/></div><div className="reason"><b>推理原因</b><ol><li>当前预算结余为 {(budget.annualBudget-budget.consumedCost).toFixed(1)}w，新增预算 {r.addedBudget}w 后，抵扣历史超支得到本场景可用预算。</li><li>系统按后台人员人天成本口径换算预算可支撑的人天。</li><li>下月需求总量为 {r.totalDays} 人天，本场景需减少或延后 {r.reductionNeeded.toFixed(1)} 人天。</li><li>优先保留紧急/高优先级、重要用户、有预算状态、已承诺未获取、合规监管类需求。</li></ol></div><Decision title="建议保留" rows={r.retained}/><Decision title="建议延期" rows={r.deferred}/><Decision title="建议削减" rows={r.cut}/></section>)}</>;
}

function Decision({title, rows}) { return <div className="decision"><h3>{title}</h3>{rows.length===0?<p className="empty">无</p>:<MiniTable rows={rows.map(row => ({ ...row, budgetStatusText: row.budgetStatus }))} cols={[[ 'title','需求'],['priority','优先级'],['landingDate','计划落地日期'],['days','人天'],['budgetStatusText','预算状态'],['score','评分'],['reason','原因']]}/>}</div>; }
function MiniTable({rows, cols}) {
  const [sort, setSort] = useState({ key: '', direction: 'asc' });
  const sortedRows = useMemo(() => sortRows(rows, sort), [rows, sort]);
  return <div className="mini-table"><table><thead><tr>{cols.map(c=><th key={c[0]}><button className="table-sort-trigger" onClick={()=>setSort(current=>toggleSort(current, c[0]))}>{c[1]}<span className="sort-indicator">{sort.key === c[0] ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span></button></th>)}</tr></thead><tbody>{sortedRows.length ? sortedRows.map((r,i)=><tr key={i}>{cols.map(c=><td key={c[0]}>{typeof r[c[0]]==='boolean' ? (r[c[0]]?'是':'否') : r[c[0]]}</td>)}</tr>) : <tr><td colSpan={cols.length}>暂无数据</td></tr>}</tbody></table></div>;
}

function Manual() { return <><Header title="Web版操作说明手册" desc="普通用户可按本手册了解每个功能的用途和操作步骤。"/><section className="manual card"><h2>1. 需求池与数据维护</h2><p>用途：集中维护需求基础数据，支持筛选、字段编辑、导入和导出。</p><ol><li>进入系统后默认打开需求池。</li><li>查看顶部指标卡，了解需求总数、总预估人天、有预算需求数和数据缺失数量。</li><li>使用全文检索、月份范围和表头筛选定位需求；所有需求池表头都可点击排序，排序在筛选后生效。</li><li>导入时，系统会先按字段名推荐映射关系，可自行修正后再导入。</li></ol><h2>2. 需求池</h2><p>用途：集中管理所有需求提交方提供的需求清单，不在此页展示风险分析结论。</p><ol><li>点击左侧“需求池”。</li><li>使用筛选框按需求单号、提出人、需求PM、类型、需求方、状态等字段查看需求。</li><li>类型包含产品立项规划、重要用户、临时紧急需求、DFx需求、存量运营维护/差评/零星需求。</li><li>需求方包含 CBG、部门基线（OBP/存量/差评等）、GPO 等。</li><li>点击“导入”可批量导入，点击“导出”可导出当前需求数据。</li><li>如发现错误数据，可直接编辑字段或点击对应行的“删除”。</li></ol><h2>3. 提交需求</h2><p>用途：需求提交方录入新的业务需求。</p><ol><li>点击“提交需求”。</li><li>带 * 的字段为必填项，填写需求名称、需求单号、提出人、需求方、类型、优先级、状态、落地日期和工作量等核心信息。优先级含义：紧急为下个版本完成，高为2个月内完成，一般不要求时间。</li><li>工作量可选择按总量或按分项填写；按分项时系统自动汇总分析、前端、中台、后台人天。</li><li>预算状态为已获取时，可填写预算获取日期（SMP系统）。</li><li>点击“提交需求”，系统会自动进入需求池查看结果。</li></ol><h2>4. 人员管理</h2><p>用途：开发团队主管通过表格维护人员、岗位、地点和成本数据。</p><ol><li>点击“人员管理”。</li><li>点击“新增人员”录入人员姓名、工号、负责人、岗位、地点、供应商和入项时间。</li><li>默认仿真数据包含 35 个 TM 和 5 个 OD，年均成本 40w，按 270 工作日折算为约 1481.48 元/人天。</li><li>岗位可选择设计、前端、后端、数据、UX、测试、PM。</li><li>人力成本按“元/人天”填写，月度可用人天默认可按 22.5 维护。</li></ol><h2>5. 预算与风险分析</h2><p>用途：把预算分析、风险看板和预算执行分析合并在一个页面，统一维护预算池并实时计算预算扣减、月度占用、风险和执行情况。</p><ol><li>点击“预算与风险分析”。页面包含“预算池总览、月度预算占用、需求占用明细、风险分析、执行分析”五个页签。</li><li>预算池来源包括需求方提供预算、部门基线预算和其他预算；预算池可维护名称、所属需求方/部门、类型、月份、金额和说明。</li><li>需求预算优先按预算池ID匹配；没有预算池ID时，按需求方匹配预算池所属方或预算池名称。匹配失败的需求显示为“未匹配预算池”。</li><li>需求预算金额会从匹配预算池中扣减，并展示预算池剩余、使用率、接近用尽、已用尽和已超额状态。</li><li>“月度预算占用”按预算获取日期、预算承诺日期或计划落地日期归集，展示每月预算池额度、需求预算占用、执行成本占用、累计占用、剩余和超额金额。</li><li>“需求占用明细”可追溯每个需求扣减的预算池，需求ID可点击跳回需求池并展开。</li><li>“风险分析”保留原风险等级、规则分类、预算状态和风险明细能力，并新增无匹配预算池、预算池超额、近30天预算池不足等风险规则。</li><li>“执行分析”展示PM饱和度、预算池/需求方执行占用和需求映射明细；执行人天优先使用决算人力，其次使用已验收需求的结算人力，最后使用预估人天。</li><li>预算池金额、需求池预算金额、预算状态、需求方、预算日期、计划落地日期、人天成本等变化后，所有KPI、图表和表格都会动态刷新，无需手动刷新。</li></ol></section></>; }

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  const normalized = text.replace(/^\ufeff/, '');
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    const next = normalized[i + 1];
    if (ch === '"' && inQuotes && next === '"') { cell += '"'; i++; continue; }
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { row.push(cell); cell = ''; continue; }
    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i++;
      row.push(cell);
      if (row.some(v => v.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += ch;
  }
  row.push(cell);
  if (row.some(v => v.trim() !== '')) rows.push(row);
  return rows;
}

const requiredDemandImportFields = new Set(['title', 'demandNo', 'source', 'investment', 'requester', 'status', 'priority', 'landingDate', 'workloadMode', 'days']);
const demandImportFields = [
  ['title', '需求名称', ['需求名称', '需求', '标题', '需求标题']], ['demandNo', '需求单号', ['需求单号', '需求编号', 'RR单号', 'RR']], ['source', '类型', ['类型', '需求来源']], ['investment', '需求方', ['需求方', '投资来源', '预算来源']], ['demandBA', '需求BA', ['需求BA', 'BA', '业务分析师', '需求分析师']], ['demandPM', '需求PM', ['需求PM', 'PM', '项目经理', '交付PM', '需求PM', '负责人', '开发负责人', '承接人']], ['pain', '当前业务痛点', ['当前业务痛点', '业务痛点']], ['goal', '需求目标', ['需求目标']], ['value', '需求价值', ['需求价值']], ['acceptanceCriteria', '验收标准', ['验收标准', '验收条件', '验收准则', '验收口径', 'AC']], ['requester', '需求提出人', ['需求提出人', '提出人', '申请人']], ['review', '业务评审结论', ['业务评审结论', '评审结论']], ['status', '需求状态', ['需求状态', '进展状态']], ['ir', 'IR单号', ['IR单号']], ['priority', '优先级', ['优先级']], ['version', '版本', ['版本']], ['landingDate', '计划落地日期', ['计划落地日期', '计划上线日期', '计划完成日期', '落地日期']], ['workloadMode', '工作量填写方式', ['工作量填写方式', '填写方式']], ['days', '总工作量', ['总工作量', '总工作量（人天）预估', '总工作量人天', '预估人天']], ['analysis', '需求分析工作量预估', ['需求分析工作量预估', '分析']], ['frontend', '前端开发工作量预估', ['前端开发工作量预估', '前端']], ['middle', '中台开发工作量预估', ['中台开发工作量预估', '中台']], ['backend', '后台开发工作量预估', ['后台开发工作量预估', '后台']], ['finalDays', '决算人力', ['决算人力', '决算人天', '最终调整人力', '最终调整人天', '最终人力', '调整后人天']], ['settlementDays', '结算人力', ['结算人力', '结算人力资源投入', '实际结算人天']], ['funded', '是否带预算', ['是否带预算', '是否有预算']], ['budget', '预算金额w', ['预算金额w', '预算金额']], ['budgetContact', '预算接口人', ['预算接口人']], ['budgetEta', '预算承诺日期', ['预算承诺日期', '预计获取时间']], ['budgetAcquiredDate', '预算获取日期', ['预算获取日期', 'SMP预算获取日期', '预算获取日期（SMP系统）']], ['budgetStatus', '预算状态', ['预算状态']], ['committed', '是否承诺', ['是否承诺', '是否已承诺']]
];
const demandImportFieldMap = Object.fromEntries(demandImportFields.map(([key, label, aliases]) => [key, { label, aliases }]));

function guessDemandImportMapping(headers) {
  const used = new Set();
  const mapping = {};
  demandImportFields.forEach(([key, , aliases]) => {
    const match = aliases.find(alias => headers.includes(alias));
    if (match && !used.has(headers.indexOf(match))) { mapping[key] = match; used.add(headers.indexOf(match)); }
    else mapping[key] = '';
  });
  return mapping;
}

function parseDemandCsv(text, fieldMapping = null) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('CSV至少需要表头和一行数据');
  const headers = rows[0].map(h => h.trim());
  const get = (record, namesOrKey, fallback = '') => {
    const names = fieldMapping ? [fieldMapping[namesOrKey]].filter(Boolean) : namesOrKey;
    for (const name of names) {
      const idx = headers.indexOf(name);
      if (idx >= 0 && record[idx] !== undefined && String(record[idx]).trim() !== '') return String(record[idx]).trim();
    }
    return fallback;
  };
  const truthy = value => ['是', '有', 'true', 'TRUE', '1', 'yes', 'Y', 'y'].includes(String(value).trim());
  const num = value => Number(String(value || '0').replace(/[wW万人天,]/g, '')) || 0;
  const getField = (record, key, fallback = '') => fieldMapping ? get(record, key, fallback) : get(record, demandImportFieldMap[key].aliases, fallback);
  return rows.slice(1).map((record, idx) => {
    const demandNo = formatRr(getField(record, 'demandNo', ''));
    if (!isValidRr(demandNo)) throw new Error(`第${idx + 2}行需求单号无效：${demandNo || '未填写'}。${rrFormatText}`);
    return {
    title: getField(record, 'title', `导入需求${idx + 1}`),
    demandNo,
    source: getField(record, 'source', '产品立项规划'),
    investment: getField(record, 'investment', '部门基线（OBP/存量/差评等）'),
    demandBA: getField(record, 'demandBA', ''),
    demandPM: getField(record, 'demandPM', ''),
    pain: getField(record, 'pain', ''),
    goal: getField(record, 'goal', ''),
    value: getField(record, 'value', ''),
    acceptanceCriteria: getField(record, 'acceptanceCriteria', ''),
    requester: getField(record, 'requester', ''),
    review: getField(record, 'review', '待评审'),
    status: getField(record, 'status', '待评估'),
    rr: demandNo,
    ir: getField(record, 'ir', ''),
    priority: getField(record, 'priority', '高'),
    version: getField(record, 'version', ''),
    landingDate: getField(record, 'landingDate', ''),
    workloadMode: getField(record, 'workloadMode', '').includes('分项') || getField(record, 'workloadMode', '') === 'breakdown' ? 'breakdown' : 'total',
    days: num(getField(record, 'days', '0')),
    analysis: num(getField(record, 'analysis', '0')),
    frontend: num(getField(record, 'frontend', '0')),
    middle: num(getField(record, 'middle', '0')),
    backend: num(getField(record, 'backend', '0')),
    finalDays: num(getField(record, 'finalDays', '0')),
    settlementDays: num(getField(record, 'settlementDays', '0')),
    funded: truthy(getField(record, 'funded', '')) || num(getField(record, 'budget', '0')) > 0,
    budget: num(getField(record, 'budget', '0')),
    budgetContact: getField(record, 'budgetContact', ''),
    budgetEta: getField(record, 'budgetEta', ''),
    budgetAcquiredDate: getField(record, 'budgetAcquiredDate', ''),
    budgetStatus: getField(record, 'budgetStatus', ''),
    committed: truthy(getField(record, 'committed', ''))
  };
  }).filter(d => d.title && (toNumber(d.days) > 0 || toNumber(d.finalDays) > 0 || toNumber(d.analysis) + toNumber(d.frontend) + toNumber(d.middle) + toNumber(d.backend) > 0));
}

function downloadTemplate() {
  const headers = ['需求名称','需求单号','类型','需求方','需求BA','需求PM','当前业务痛点','需求目标','需求价值','验收标准','需求提出人','业务评审结论','需求状态','验收标准','IR单号','优先级','版本','计划落地日期','工作量填写方式','总工作量（人天）预估','需求分析工作量预估','前端开发工作量预估','中台开发工作量预估','后台开发工作量预估','决算人力','结算人力','是否带预算','预算金额w','预算接口人','预算承诺日期','预算获取日期','预算状态'];
  const sample = ['示例需求','RR2026053012345','产品立项规划','示例需求方','李BA','王PM','当前流程效率低','优化处理流程','提升效率','上线后核心流程可验证且异常可回滚','张三','待评审','待评估','IR-001','高','','2026-08-31','total','30','5','10','8','7','0','0','否','0','','','','已承诺未获取'];
  const csv = [headers.join(','), sample.map(v => `"${v}"`).join(',')].join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '需求导入模板.csv'; a.click();
}

function downloadImportTestCsv() {
  const headers = ['需求PM','需求编号','需求标题','预算来源','申请人','落地日期','填写方式','预估人天','分析','前端','中台','后台','决算人力','预算金额','SMP预算获取日期','进展状态','预算状态','优先级'];
  const rows = [
    ['王开发','RR2026061401001','测试导入-分项工作量','财经','财经-张三','2026-06-30','按分项','','4','8','6','7','28','12','2026-06-10','开发中','已获取','紧急'],
    ['李开发','RR2026061401002','测试导入-字段顺序不同','制造','制造-李四','2026-07-15','按总量','35','','','','','0','8','','已排期','已承诺未获取','高'],
    ['赵开发','RR2026061401003','测试导入-无预算后续需求','采购','采购-王五','2026-08-20','按总量','22','','','','','0','0','','待评估','无预算','一般'],
    ['钱开发','RR2026061401004','测试导入-已验收结算','审计','审计-赵六','2026-06-28','按总量','18','','','','','0','20','2026-06-12','已验收','已获取','高'],
    ['孙开发','RR2026061401005','测试导入-最终人力优先','供应','供应-孙七','2026-07-31','按总量','40','','','','','32','16','2026-06-18','已上线','已获取','紧急']
  ];
  const csv = [headers.join(','), ...rows.map(row => row.map(v => `"${v}"`).join(','))].join('\n');
  const blob = new Blob(['\ufeff' + csv], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '需求导入映射测试表.csv'; a.click();
}

function downloadCsv(demands) {
  const headers = ['需求名称','需求单号','类型','需求方','需求BA','需求PM','验收标准','IR单号','优先级','版本','计划落地日期','工作量填写方式','总工作量','决算人力','结算人力','预算金额w','预算接口人','预算承诺日期','预算获取日期','预算状态','评审结论','需求状态'];
  const lines = [headers.join(',')].concat(demands.map(d => [d.title,d.demandNo,d.source,d.investment,d.demandBA || '',d.demandPM || '',d.acceptanceCriteria || '',d.ir,d.priority,d.version,d.landingDate || '',d.workloadMode || 'total',toNumber(d.days),toNumber(d.finalDays),toNumber(d.settlementDays),d.budget,d.budgetContact || '',d.budgetEta || '',d.budgetAcquiredDate || '',d.budgetStatus || '无预算',d.review,d.status].map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')));
  const blob = new Blob([lines.join('\n')], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'demands.csv'; a.click();
}

createRoot(document.getElementById('root')).render(<App/>);
