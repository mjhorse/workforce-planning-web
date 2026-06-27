import React, { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ReactECharts from 'echarts-for-react';
import { BarChart3, BookOpen, CalendarDays, ClipboardList, FileText, Network, PieChart, Settings, Tags, Users } from 'lucide-react';
import './styles.css';

const toNumber = value => Number(String(value ?? 0).replace(/[wW万人天,]/g, '')) || 0;
const demandStatusOptions = ['已提交', '分析中', '已分析', '已驳回', '已排期', '开发中', '已上线', '已验收'];
const priorityOptions = ['紧急', '高', '一般'];
const demandTypeOptions = ['产品立项规划', '重要用户', '临时紧急需求', 'DFx需求', '存量运营维护/差评/零星需求'];
const demandTypeAliases = { DFX需求: 'DFx需求', DFX: 'DFx需求', DFX类需求: 'DFx需求', 存量运营维护: '存量运营维护/差评/零星需求', 差评需求: '存量运营维护/差评/零星需求', 零星需求: '存量运营维护/差评/零星需求' };
const priorityAliases = { P0: '紧急', P1: '紧急', P2: '高', P3: '一般', P4: '一般' };
const baselineDemandParty = '生产办公运营中心';
const legacyBaselineDemandParty = '部门基线（OBP/存量/差评等）';
const budgetSourceTypeOptions = ['部门基线', '其他'];
const otherBudgetSourceOptions = ['财经', '行政', 'HR', 'ICT', '区域', 'GPO'];
const demandPartyOptions = ['制造', '审计', '供应', '财经', '采购', '行政', 'CBG', baselineDemandParty, 'GPO'];
const supplierOptions = ['赛意', '软通'];
const personnelTypeOptions = ['OD', 'TM', '其他'];
const poPersonnelTypeOptions = ['TM', 'OD'];
const personnelPositionOptions = ['设计', '前端', '后端', '数据', 'UX', '测试', 'PM'];
const legacySupplierOptions = ['内部', '供应商A', '供应商B', '供应商C'];
const featureLevelKeys = ['l1','l2','l3','l4','l5','l6','l7'];
const featureStatusOptions = ['启用', '停用'];
const integrationPointStatusOptions = ['启用', '停用'];
const normalizeSupplier = value => supplierOptions.includes(String(value || '').trim()) ? String(value || '').trim() : '';
const normalizePersonnelSupplier = (value, idx = 0) => {
  const normalized = normalizeSupplier(value);
  if (normalized) return normalized;
  const raw = String(value ?? '').trim();
  if (!raw || legacySupplierOptions.includes(raw)) return supplierOptions[idx % supplierOptions.length];
  return '';
};
const normalizePersonnelType = value => {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'TM') return 'TM';
  if (normalized === 'OD') return 'OD';
  return '其他';
};
const inferPersonnelType = p => {
  const normalized = normalizePersonnelType(p.personnelType || p.type || p.category);
  if (normalized !== '其他') return normalized;
  const text = `${p.employeeNo || ''} ${p.name || ''}`.toUpperCase();
  if (/\bTM\b|TM[-_\s]?\d|TM人员/.test(text)) return 'TM';
  if (/\bOD\b|OD[-_\s]?\d|OD人员/.test(text)) return 'OD';
  return '其他';
};
const workloadRoleOptions = [
  ['analysis', '分析'], ['frontend', '前端'], ['middle', '中台'], ['backend', '后端'], ['other', '其他']
];
const workloadRoleLabels = Object.fromEntries(workloadRoleOptions);
const budgetStatusOptions = ['无预算', '已承诺未获取', '已获取', '获取超期'];
const budgetStatusAliases = { 已承诺: '已承诺未获取', 已超期: '获取超期', 预算已超期: '获取超期' };
const isBudgetCommitted = status => status === '已承诺未获取' || status === '获取超期';
const hasBudget = d => (d.budgetStatus || '') !== '无预算';
const demandPartyAliases = { 部门自投: baselineDemandParty, 部门基线: baselineDemandParty, [legacyBaselineDemandParty]: baselineDemandParty, [baselineDemandParty]: baselineDemandParty, 部门非基线: 'GPO' };
const rrPattern = /^RR\d{13}$/;
const rrInputPattern = /^(|R|RR|RR\d{0,13})$/;
const irPattern = /^IR\d{13}$/;
const irInputPattern = /^(|I|IR|IR\d{0,13})$/;
const analysisStageOptions = ['已提交', '分析中', '已分析'];
const formatRr = value => String(value ?? '').trim().toUpperCase();
const formatIr = value => String(value ?? '').trim().toUpperCase();
const isValidRr = value => rrPattern.test(formatRr(value));
const isValidRrInput = value => rrInputPattern.test(formatRr(value));
const isValidIr = value => irPattern.test(formatIr(value));
const isValidIrInput = value => irInputPattern.test(formatIr(value));
const rrFormatText = '需求单号格式：RRYYYYMMDD随机5位数，例如 RR2026053012345';
const irFormatText = 'IR单号格式：IRYYYYMMDD随机5位数，例如 IR2026053012345';
const getDemandKind = d => String(d?.demandKind || '').toUpperCase() === 'IR' || d?.parentRrId ? 'IR' : 'RR';
const isRrDemand = d => getDemandKind(d) === 'RR';
const isIrDemand = d => getDemandKind(d) === 'IR';
const getIrWorkload = ir => toNumber(ir?.featureWorkload || ir?.days);
const getRrChildren = (demands, rr) => (Array.isArray(demands) ? demands : []).filter(d => isIrDemand(d) && (String(d.parentRrId || '') === String(rr?.id || '') || (d.parentRrNo && formatRr(d.parentRrNo) === formatRr(rr?.demandNo || rr?.rr))));
const getRrChildWorkload = (rr, demands) => getRrChildren(demands, rr).reduce((sum, ir) => sum + getIrWorkload(ir), 0);
const normalizeIntegrationPointWorkloads = (rows = [], demandKey = 'demand') => (Array.isArray(rows) ? rows : []).map((row, idx) => ({
  id: row.id || `ipw-${demandKey}-${idx}-${Date.now()}`,
  integrationPointId: row.integrationPointId || '',
  product: String(row.product || '').trim(),
  subProduct: String(row.subProduct || '').trim(),
  itService: String(row.itService || '').trim(),
  module: String(row.module || '').trim(),
  interfaceContent: row.interfaceContent || '',
  allocatedWorkload: row.allocatedWorkload === '' ? '' : toNumber(row.allocatedWorkload)
})).filter(row => row.integrationPointId || row.product || row.subProduct || row.itService || row.module || row.interfaceContent || toNumber(row.allocatedWorkload) > 0);
const getIntegrationPointWorkloadDays = d => normalizeIntegrationPointWorkloads(d?.integrationPointWorkloads || [], d?.id || d?.demandNo || 'demand').reduce((sum, row) => sum + toNumber(row.allocatedWorkload), 0);
const getRrBaseWorkloadDays = d => toNumber(d?.baseWorkloadDays ?? d?.days);
const getRrOwnTotalWorkloadDays = d => getRrBaseWorkloadDays(d) + getIntegrationPointWorkloadDays(d);
const formatIntegrationPointWorkloads = d => {
  const rows = normalizeIntegrationPointWorkloads(d?.integrationPointWorkloads || [], d?.id || d?.demandNo || 'demand');
  return rows.length ? rows.map(row => `${[row.product, row.subProduct, row.itService, row.module].filter(Boolean).join(' / ')}：${toNumber(row.allocatedWorkload)}人天${row.interfaceContent ? `（${row.interfaceContent}）` : ''}`).join('；') : '';
};
const getDemandDisplayDays = (d, demands = []) => {
  if (isIrDemand(d)) return getIrWorkload(d);
  const ipDays = getIntegrationPointWorkloadDays(d);
  const children = getRrChildren(demands, d);
  return (children.length ? getRrChildWorkload(d, demands) : getRrBaseWorkloadDays(d)) + ipDays;
};
const getWorkloadBearingDemands = demands => {
  const all = Array.isArray(demands) ? demands : [];
  return all.flatMap(d => {
    if (isIrDemand(d)) return [{ ...d, days: getDemandDisplayDays(d, all) }];
    const children = getRrChildren(all, d);
    if (!children.length) return [{ ...d, days: getDemandDisplayDays(d, all) }];
    const ipDays = getIntegrationPointWorkloadDays(d);
    return ipDays > 0 ? [{ ...d, days: ipDays, baseWorkloadDays: 0 }] : [];
  });
};
const getUnifiedBudgetSourceValue = d => d?.budgetSourceType === '其他' ? (d.budgetSource || otherBudgetSourceOptions[0]) : '部门基线';
const applyUnifiedBudgetSource = (next, value) => {
  next.budgetSourceType = value === '部门基线' ? '部门基线' : '其他';
  next.budgetSource = value === '部门基线' ? '' : value;
  next.budgetPoolId = '';
  return next;
};
const validateDemand = (d, existingDemands = [], currentId = null, features = null, integrationPoints = null) => {
  const kind = getDemandKind(d);
  if (kind === 'IR') {
    const irNo = formatIr(d.irNo || d.ir);
    if (!irNo) return 'IR单号必填';
    if (!isValidIr(irNo)) return irFormatText;
    if (existingDemands.some(item => item.id !== currentId && isIrDemand(item) && formatIr(item.irNo || item.ir) === irNo)) return `IR单号不能重复：${irNo}`;
    if (!d.parentRrId && !d.parentRrNo) return 'IR必须关联RR';
    if (!d.featureId && !d.featureCode) return 'IR必须关联特性';
    if (features?.rows?.length && !findFeature(features, d.featureId, d.featureCode)) return '关联特性无效或已不存在';
    if (toNumber(d.featureWorkload) <= 0) return '特性工作量必须大于0';
    const parent = existingDemands.find(item => isRrDemand(item) && (String(item.id) === String(d.parentRrId) || formatRr(item.demandNo || item.rr) === formatRr(d.parentRrNo)));
    if (!parent) return '关联RR不存在';
    const otherWorkload = existingDemands.filter(item => item.id !== currentId && isIrDemand(item) && (String(item.parentRrId || '') === String(parent.id) || formatRr(item.parentRrNo) === formatRr(parent.demandNo || parent.rr))).reduce((sum, item) => sum + getIrWorkload(item), 0);
    if (otherWorkload + toNumber(d.featureWorkload) > getRrBaseWorkloadDays(parent)) return `IR特性工作量合计不能超出RR基础工作量（${getRrBaseWorkloadDays(parent)}人天）`;
    return '';
  }
  const demandNo = formatRr(d.demandNo || d.rr);
  if (isScheduled(d.status) && !demandNo) return '已排期及后续状态必须填写RR需求单号';
  if (demandNo && !isValidRr(demandNo)) return rrFormatText;
  if (demandNo && existingDemands.some(item => item.id !== currentId && isRrDemand(item) && formatRr(item.demandNo || item.rr) === demandNo)) return `RR需求单号不能重复：${demandNo}`;
  if (!analysisStageOptions.includes(d.analysisStage)) return '分析阶段必填';
  if (toNumber(d.baseWorkloadDays ?? d.days) > 0 && d.status !== '分析中' && getRrChildren(existingDemands, d).length === 0) return '只有分析中的需求才能填写基础工作量';
  const enabledRows = integrationPoints?.rows || [];
  const ipRows = normalizeIntegrationPointWorkloads(d.integrationPointWorkloads || [], d.id || d.demandNo || currentId || 'demand');
  for (const [idx, row] of ipRows.entries()) {
    if (!row.integrationPointId && (!row.product || !row.subProduct)) return `第${idx + 1}行集成点必须选择目录项`;
    if (!row.product || !row.subProduct) return `第${idx + 1}行集成点产品和子产品必填`;
    if (toNumber(row.allocatedWorkload) <= 0) return `第${idx + 1}行集成点分摊工作量必须大于0`;
    if (!String(row.interfaceContent || '').trim()) return `第${idx + 1}行集成诉求必填`;
    if (row.integrationPointId && enabledRows.length && !findIntegrationPoint(integrationPoints, row.integrationPointId, row.product, row.subProduct, row.itService, row.module)) return `第${idx + 1}行集成点目录项无效或已不存在`;
  }
  return '';
};
const getDuplicateDemandNos = demands => {
  const seenRr = new Set();
  const seenIr = new Set();
  const duplicates = new Set();
  demands.forEach(d => {
    if (isIrDemand(d)) {
      const irNo = formatIr(d.irNo || d.ir);
      if (!irNo) return;
      if (seenIr.has(irNo)) duplicates.add(irNo);
      seenIr.add(irNo);
      return;
    }
    const demandNo = formatRr(d.demandNo || d.rr);
    if (!demandNo) return;
    if (seenRr.has(demandNo)) duplicates.add(demandNo);
    seenRr.add(demandNo);
  });
  return [...duplicates];
};
const statusAliases = { 待评估: '已提交', 待分析: '已提交', 分析完成: '已分析', 待启动: '已提交', 进行中: '开发中', 已承诺: '已排期', 暂停: '已提交' };
const isScheduled = status => ['已排期', '开发中', '已上线', '已验收'].includes(status);
const alignBudgetSourceWithDemandParty = investment => {
  const normalized = demandPartyAliases[investment] || investment || baselineDemandParty;
  if (normalized === baselineDemandParty) return { budgetSourceType: '部门基线', budgetSource: '' };
  return { budgetSourceType: '其他', budgetSource: otherBudgetSourceOptions.includes(normalized) ? normalized : '' };
};
const normalizeDemand = d => {
  const kind = getDemandKind(d);
  const status = statusAliases[d.status] || d.status || '分析中';
  const source = demandTypeAliases[d.source] || d.source || '产品立项规划';
  const demandNo = kind === 'RR' ? formatRr(d.demandNo || d.rr) : formatRr(d.parentRrNo || d.rr || d.demandNo);
  const rawBudgetStatus = budgetStatusAliases[d.budgetStatus] || d.budgetStatus;
  const budgetStatus = budgetStatusOptions.includes(rawBudgetStatus) ? rawBudgetStatus : (d.committed ? '已承诺未获取' : (d.funded || toNumber(d.budget) > 0 ? '已获取' : '无预算'));
  const funded = budgetStatus !== '无预算';
  const alignedBudgetSource = alignBudgetSourceWithDemandParty(demandPartyAliases[d.investment] || d.investment || baselineDemandParty);
  const rawBudgetSourceType = d.budgetSourceType || alignedBudgetSource.budgetSourceType;
  const budgetSourceType = budgetSourceTypeOptions.includes(rawBudgetSourceType) ? rawBudgetSourceType : (otherBudgetSourceOptions.includes(rawBudgetSourceType) ? '其他' : alignedBudgetSource.budgetSourceType);
  const budgetSource = budgetSourceType === '其他' ? (otherBudgetSourceOptions.includes(d.budgetSource) ? d.budgetSource : (otherBudgetSourceOptions.includes(rawBudgetSourceType) ? rawBudgetSourceType : alignedBudgetSource.budgetSource)) : '';
  const workloadMode = d.workloadMode === 'breakdown' ? 'breakdown' : 'total';
  const workloadAssignments = (Array.isArray(d.workloadAssignments) ? d.workloadAssignments : []).map((item, idx) => ({
    id: item.id || `${d.id || d.demandNo || d.rr || 'new'}-${idx}`,
    personnelId: item.personnelId,
    role: workloadRoleLabels[item.role] ? item.role : 'other',
    days: toNumber(item.days),
    note: item.note || ''
  })).filter(item => item.personnelId && item.days > 0);
  const breakdownDays = toNumber(d.analysis) + toNumber(d.frontend) + toNumber(d.middle) + toNumber(d.backend);
  const featureWorkload = toNumber(d.featureWorkload || d.days);
  const integrationPointWorkloads = kind === 'RR' ? normalizeIntegrationPointWorkloads(d.integrationPointWorkloads || [], d.id || d.demandNo || d.rr || 'demand') : [];
  const integrationPointDays = integrationPointWorkloads.reduce((sum, row) => sum + toNumber(row.allocatedWorkload), 0);
  const rawBaseWorkloadDays = kind === 'RR' ? (workloadMode === 'breakdown' ? breakdownDays : (d.baseWorkloadDays !== undefined ? d.baseWorkloadDays : d.days)) : 0;
  const baseWorkloadDays = kind === 'RR' ? (rawBaseWorkloadDays === '' ? '' : toNumber(rawBaseWorkloadDays)) : 0;
  const normalizedDays = kind === 'IR' ? featureWorkload : toNumber(baseWorkloadDays) + integrationPointDays;
  const normalizedSettlementDays = ['已上线', '已验收'].includes(status) ? (d.settlementDays === '' || d.settlementDays === undefined || d.settlementDays === null ? toNumber(normalizedDays) : toNumber(d.settlementDays)) : 0;
  const normalizedFinalDays = status === '已验收' ? (d.finalDays === '' || d.finalDays === undefined || d.finalDays === null ? toNumber(normalizedSettlementDays) : toNumber(d.finalDays)) : 0;
  return {
    ...d,
    demandKind: kind,
    status,
    source,
    demandNo: kind === 'RR' ? demandNo : '',
    rr: kind === 'RR' ? demandNo : (formatRr(d.parentRrNo) || ''),
    demandBA: d.demandBA || d.ba || '',
    demandPM: d.demandPM || d.pm || d.executor || '',
    priority: priorityAliases[d.priority] || d.priority || '一般',
    investment: demandPartyAliases[d.investment] || d.investment || baselineDemandParty,
    budgetSourceType,
    budgetSource,
    budgetPoolId: d.budgetPoolId || '',
    poPeriod: d.poPeriod || (d.landingDate ? String(d.landingDate).slice(0, 7) : getCurrentMonthKey()),
    version: isScheduled(status) ? (d.version || '') : '',
    budgetStatus,
    budgetContact: budgetStatus !== '无预算' ? (d.budgetContact || '') : '',
    budgetEta: isBudgetCommitted(budgetStatus) ? (d.budgetEta || '') : '',
    budgetAcquiredDate: budgetStatus === '已获取' ? (d.budgetAcquiredDate || '') : '',
    workloadMode,
    workloadAssignments,
    days: normalizedDays,
    baseWorkloadDays: kind === 'RR' ? baseWorkloadDays : 0,
    integrationPointWorkloads,
    analysisStage: analysisStageOptions.includes(statusAliases[d.analysisStage] || d.analysisStage) ? (statusAliases[d.analysisStage] || d.analysisStage) : (analysisStageOptions.includes(status) ? status : '已提交'),
    analysisConclusion: d.analysisConclusion || '',
    parentRrId: kind === 'IR' ? (d.parentRrId || '') : '',
    parentRrNo: kind === 'IR' ? formatRr(d.parentRrNo || d.rr || d.demandNo) : '',
    irNo: kind === 'IR' ? formatIr(d.irNo || d.ir) : '',
    ir: kind === 'IR' ? formatIr(d.irNo || d.ir) : (d.ir || ''),
    featureId: kind === 'IR' ? (d.featureId || '') : '',
    featureCode: kind === 'IR' ? String(d.featureCode || '').trim() : '',
    featureWorkload: kind === 'IR' ? featureWorkload : 0,
    finalDays: normalizedFinalDays,
    committed: isBudgetCommitted(budgetStatus),
    settlementDays: normalizedSettlementDays,
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
  { id: 'HIGH-BUDGET-OVERDUE', name: '预算获取超期', level: 'high', category: '预算时效', description: '工作量成本状态被标记为获取超期。', action: '升级预算接口人并明确获取日期', match: row => row.budgetStatus === '获取超期' },
  { id: 'HIGH-LANDING-30-NO-BUDGET', name: '近 30 天落地但预算未获取', level: 'high', category: '预算时效', description: '计划落地日期在 30 天内，且预算尚未获取或结算。', action: '优先补齐预算或调整落地范围', match: (row, ctx) => ctx.daysToLanding >= 0 && ctx.daysToLanding <= 30 && !hasBudgetAcquired(row) },
  { id: 'HIGH-ETA-PAST-NO-BUDGET', name: '预算承诺日期已过但仍未获取', level: 'high', category: '预算时效', description: '预算承诺日期已经过去，且预算尚未获取或结算。', action: '升级预算承诺兑现并更新日期', match: row => row.budgetEta && isPastDate(row.budgetEta) && !hasBudgetAcquired(row) },
  { id: 'HIGH-IN-PROGRESS-NO-BUDGET', name: '开发中/已上线但预算未获取', level: 'high', category: '进度状态', description: '需求已进入开发中或已上线状态，但预算尚未获取或结算。', action: '暂停新增投入前确认预算闭环', match: row => ['开发中', '已上线'].includes(row.status) && !hasBudgetAcquired(row) },
  { id: 'HIGH-ACCEPTED-NO-SETTLEMENT', name: '已验收但未结算', level: 'high', category: '结算闭环', description: '需求状态为已验收，但结算人力尚未填写。', action: '补齐结算人力并完成预算结算', match: row => row.status === '已验收' && toNumber(row.settlementDays) <= 0 },
  { id: 'MEDIUM-COMMITTED-NO-ETA', name: '已承诺未获取但没有预算承诺日期', level: 'medium', category: '预算时效', description: '预算处于已承诺未获取或获取超期状态，但未填写预算承诺日期。', action: '补充预算承诺日期并跟踪兑现', match: row => row.dashboardBudgetStatus === '已承诺未获取' && !row.budgetEta },
  { id: 'MEDIUM-LANDING-60-NO-BUDGET', name: '60 天内落地但预算未获取', level: 'medium', category: '预算时效', description: '计划落地日期在 60 天内，且预算尚未获取或结算。', action: '纳入周度预算跟踪清单', match: (row, ctx) => ctx.daysToLanding >= 0 && ctx.daysToLanding <= 60 && !hasBudgetAcquired(row) },
  { id: 'MEDIUM-LARGE-DAYS-NO-BUDGET', name: '人天较大且预算未获取', level: 'medium', category: '预算覆盖', description: '预估人天达到 80 人天及以上，且预算尚未获取或结算。', action: '复核预算金额与人天口径', match: row => row.days >= 80 && !hasBudgetAcquired(row) },
  { id: 'MEDIUM-BUDGET-LESS-THAN-COST', name: '工作量成本低于估算成本', level: 'medium', category: '预算覆盖', description: '按人员明细计算的工作量成本小于按预算配置中人天成本口径估算的需求成本。', action: '复核人员工作量明细与人天口径', match: row => hasBudgetAcquired(row) && !row.missingPersonnelCost && row.workloadCost < row.estimatedCost },
  { id: 'HIGH-NO-BUDGET-POOL', name: '需求无匹配预算池', level: 'high', category: '预算池', description: '需求方或预算池ID无法匹配任何预算池，预算扣减来源不明确。', action: '维护预算池所属方，或在需求中补齐需求方', match: row => !row.matchedBudgetPool },
  { id: 'HIGH-POOL-OVERSPENT-ACTIVE', name: '预算池超额仍有执行需求', level: 'high', category: '预算池', description: '匹配预算池已超额，且需求仍处于已排期、开发中或已上线状态。', action: '暂停新增投入或追加预算池额度', match: row => row.poolOverBudget && ['已排期', '开发中', '已上线'].includes(row.status) },
  { id: 'MEDIUM-DEMAND-BUDGET-OVER-POOL-REMAINING', name: '工作量成本超过预算池剩余额度', level: 'medium', category: '预算池', description: '单需求人员工作量成本大于匹配预算池剩余额度。', action: '拆分需求范围或确认追加预算', match: row => row.matchedBudgetPool && row.workloadCost > Math.max(0, row.poolRemaining) },
  { id: 'HIGH-MISSING-PERSONNEL-COST', name: '未选择人员，预算占用未计算', level: 'high', category: '预算池', description: '需求没有人员工作量明细，无法计算预算池占用。', action: '在需求工作量信息中选择具体人员并填写人天', match: row => row.missingPersonnelCost },
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

function parseDateKey(dateKey) {
  const [year, month, day] = String(dateKey || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function getCurrentDateKey() {
  return formatDateKey(new Date());
}

function getDateKeyAfterDays(days) {
  return formatDateKey(addDays(new Date(), days));
}

const chinaWorkCalendar = {
  2026: {
    holidays: {
      '2026-01-01': '元旦', '2026-01-02': '元旦', '2026-01-03': '元旦',
      '2026-02-15': '春节', '2026-02-16': '春节', '2026-02-17': '春节', '2026-02-18': '春节', '2026-02-19': '春节', '2026-02-20': '春节', '2026-02-21': '春节', '2026-02-22': '春节', '2026-02-23': '春节',
      '2026-04-04': '清明节', '2026-04-05': '清明节', '2026-04-06': '清明节',
      '2026-05-01': '劳动节', '2026-05-02': '劳动节', '2026-05-03': '劳动节', '2026-05-04': '劳动节', '2026-05-05': '劳动节',
      '2026-06-19': '端午节', '2026-06-20': '端午节', '2026-06-21': '端午节',
      '2026-09-25': '中秋节', '2026-09-26': '中秋节', '2026-09-27': '中秋节',
      '2026-10-01': '国庆节', '2026-10-02': '国庆节', '2026-10-03': '国庆节', '2026-10-04': '国庆节', '2026-10-05': '国庆节', '2026-10-06': '国庆节', '2026-10-07': '国庆节'
    },
    workdays: {
      '2026-02-14': '春节调休上班',
      '2026-04-26': '劳动节调休上班',
      '2026-05-09': '劳动节调休上班',
      '2026-09-20': '国庆节调休上班',
      '2026-10-10': '国庆节调休上班'
    }
  }
};

const workCalendarTypeLabels = {
  workday: '普通工作日',
  weekend: '周末',
  holiday: '法定节假日',
  adjustedWorkday: '调休上班日'
};

function classifyWorkCalendarDate(date) {
  const dateKey = formatDateKey(date);
  const yearConfig = chinaWorkCalendar[date.getFullYear()];
  if (yearConfig?.workdays[dateKey]) return { date: dateKey, type: 'adjustedWorkday', effective: true, note: yearConfig.workdays[dateKey], isConfiguredYear: true };
  if (yearConfig?.holidays[dateKey]) return { date: dateKey, type: 'holiday', effective: false, note: yearConfig.holidays[dateKey], isConfiguredYear: true };
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  return { date: dateKey, type: isWeekend ? 'weekend' : 'workday', effective: !isWeekend, note: isWeekend ? '周末休息' : '按工作日规则', isConfiguredYear: Boolean(yearConfig) };
}

function calculateWorkCalendarRange(startDateKey, endDateKey) {
  if (!startDateKey || !endDateKey) return { error: '请选择开始日期和结束日期。' };
  const startDate = parseDateKey(startDateKey);
  const endDate = parseDateKey(endDateKey);
  if (!startDate || !endDate) return { error: '日期格式无效。' };
  if (startDate > endDate) return { error: '开始日期不能晚于结束日期。' };
  const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  if (totalDays > 3660) return { error: '日期范围过大，请选择 10 年以内的范围。' };

  const details = [];
  const unconfiguredYears = new Set();
  const result = { totalDays, effectiveDays: 0, invalidDays: 0, holidayDays: 0, weekendDays: 0, adjustedWorkdays: 0, details, unconfiguredYears: [] };
  for (let cursor = startDate; cursor <= endDate; cursor = addDays(cursor, 1)) {
    const item = classifyWorkCalendarDate(cursor);
    details.push(item);
    if (!item.isConfiguredYear) unconfiguredYears.add(cursor.getFullYear());
    if (item.effective) result.effectiveDays += 1;
    else result.invalidDays += 1;
    if (item.type === 'holiday') result.holidayDays += 1;
    if (item.type === 'weekend') result.weekendDays += 1;
    if (item.type === 'adjustedWorkday') result.adjustedWorkdays += 1;
  }
  result.unconfiguredYears = [...unconfiguredYears].sort((a, b) => a - b);
  return result;
}

function buildMonthOptions(demands) {
  const currentYear = new Date().getFullYear();
  const months = new Set(Array.from({ length: 12 }, (_, idx) => `${currentYear}-${String(idx + 1).padStart(2, '0')}`));
  demands.forEach(d => { if (d.landingDate) months.add(String(d.landingDate).slice(0, 7)); });
  return [...months].sort();
}

function getDemandPoPeriod(d) {
  return d?.poPeriod || (d?.landingDate ? String(d.landingDate).slice(0, 7) : '') || getCurrentMonthKey();
}

function buildPoPeriodOptions(demands) {
  const months = new Set([getCurrentMonthKey()]);
  demands.forEach(d => {
    if (d.poPeriod) months.add(String(d.poPeriod).slice(0, 7));
    if (d.landingDate) months.add(String(d.landingDate).slice(0, 7));
  });
  return [...months].filter(Boolean).sort();
}

function formatPoPeriod(period) {
  return formatMonthLabel(period || getCurrentMonthKey());
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

function isDepartmentBaselinePool(pool) {
  const text = `${pool?.name || ''} ${pool?.ownerDept || ''}`;
  return pool?.type === 'department-baseline' || text.includes('部门基线') || text.includes(legacyBaselineDemandParty) || text.includes(baselineDemandParty);
}

function matchDemandBudgetPool(demand, pools = []) {
  const normalizedPools = Array.isArray(pools) ? pools : [];
  if (demand.budgetPoolId) {
    const byId = normalizedPools.find(pool => String(pool.id) === String(demand.budgetPoolId));
    if (byId) return byId;
  }
  if (demand.budgetSourceType === '部门基线') {
    const baselinePool = normalizedPools.find(pool => isDepartmentBaselinePool(pool));
    if (baselinePool) return baselinePool;
  }
  if (demand.budgetSourceType === '其他' && demand.budgetSource) {
    const source = String(demand.budgetSource).trim();
    const otherPool = normalizedPools.find(pool => pool.type === 'other' && [pool.ownerDept, pool.name].some(value => String(value || '').includes(source) || source.includes(String(value || ''))));
    if (otherPool) return otherPool;
  }
  const investment = String(demandPartyAliases[demand.investment] || demand.investment || '').trim();
  if (!investment) return null;
  return normalizedPools.find(pool => [pool.ownerDept, pool.name].some(value => String(value || '').includes(investment) || investment.includes(String(value || '')))) || null;
}

function getDemandBudgetPoolInfo(demand, budget, allDemands, personnel = [], currentDemandId = null) {
  const pools = Array.isArray(budget?.pools) ? budget.pools : [];
  const pool = matchDemandBudgetPool(demand, pools);
  const currentCost = getDemandWorkloadCostWan(demand, personnel);
  const missingPersonnelCost = !hasWorkloadAssignmentCost(demand, personnel);
  if (!pool) return { pool: null, row: null, remaining: 0, currentCost, missingPersonnelCost, overAmount: currentCost };
  const otherDemands = (Array.isArray(allDemands) ? allDemands : []).filter(item => item.id !== currentDemandId);
  const row = buildBudgetPoolRows(otherDemands, budget, personnel).find(item => String(item.id) === String(pool.id));
  const remaining = (row?.amount ?? getBudgetPoolAmount(pool)) - (row?.demandBudget ?? 0);
  return { pool, row, remaining, currentCost, missingPersonnelCost, overAmount: Math.max(0, currentCost - remaining) };
}

function getBudgetPoolStatus(amount, occupied) {
  if (amount <= 0 && occupied > 0) return '无预算池';
  if (occupied > amount) return '已超额';
  if (amount > 0 && occupied >= amount) return '已用尽';
  if (amount > 0 && occupied / amount >= 0.85) return '接近用尽';
  return '正常';
}

function buildBudgetPoolRows(demands, budget, personnel = []) {
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
    missingCostDemandCount: 0,
    overAmount: 0,
    demandIds: []
  }]));
  const unmatchedKey = '__unmatched__';
  rows.set(unmatchedKey, { id: unmatchedKey, name: unmatchedBudgetPoolName, ownerDept: '未匹配', type: 'other', typeLabel: '未匹配', month: '未匹配', description: '需求方或预算池ID无法匹配预算池', amount: 0, demandCount: 0, demandBudget: 0, executionCost: 0, executedCost: 0, scheduledCost: 0, laterCost: 0, executedDays: 0, scheduledDays: 0, laterDays: 0, noBudgetCount: 0, overBudgetDemandCount: 0, missingCostDemandCount: 0, overAmount: 0, demandIds: [] });
  demands.forEach(d => {
    const pool = matchDemandBudgetPool(d, pools);
    const key = pool ? String(pool.id) : unmatchedKey;
    const row = rows.get(key);
    const demandBudget = getDemandWorkloadCostWan(d, personnel);
    const executionDays = getExecutionDays(d);
    const executionCost = getDemandExecutionCost(d, budget);
    const stage = getExecutionStage(d);
    row.demandCount += 1;
    row.demandBudget += demandBudget;
    row.executionCost += executionCost;
    row.demandIds.push(d.id);
    if (!hasWorkloadAssignmentCost(d, personnel)) row.missingCostDemandCount += 1;
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
    const overAmount = Math.max(0, row.demandBudget - row.amount);
    return { ...row, remaining, executionRemaining, usageRate, executionRate, status, overAmount, totalExecutionCost: row.executionCost, source: row.name };
  }).sort((a, b) => (a.id === unmatchedKey ? 1 : b.id === unmatchedKey ? -1 : b.demandBudget - a.demandBudget));
}

function buildMonthlyBudgetOccupationRows(demands, budget, personnel = []) {
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
    row.demandBudget += getDemandWorkloadCostWan(d, personnel);
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

function buildBudgetOccupationDemandRows(demands, budget, personnel = []) {
  const poolRows = buildBudgetPoolRows(demands, budget, personnel);
  const poolRowById = new Map(poolRows.map(row => [String(row.id), row]));
  return demands.map(d => {
    const pool = matchDemandBudgetPool(d, budget?.pools || []);
    const poolRow = pool ? poolRowById.get(String(pool.id)) : null;
    const budgetAmount = getDemandWorkloadCostWan(d, personnel);
    const missingPersonnelCost = !hasWorkloadAssignmentCost(d, personnel);
    const executionCost = getDemandExecutionCost(d, budget);
    return {
      ...d,
      demandId: d.demandNo || d.rr || d.id,
      source: d.source || '未填写类型',
      investment: d.investment || '未填写需求方',
      budgetSourceType: d.budgetSourceType || '部门基线',
      budgetSource: d.budgetSourceType === '其他' ? (d.budgetSource || '') : '',
      budgetPoolId: pool?.id || '',
      budgetPoolName: pool?.name || unmatchedBudgetPoolName,
      matchedBudgetPool: Boolean(pool),
      budgetAmount,
      workloadCost: budgetAmount,
      missingPersonnelCost,
      personnelWorkloadText: formatWorkloadAssignments(d, personnel),
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


function buildDemandBudgetSourceRows(demands, budget, personnel = []) {
  const rows = new Map();
  demands.forEach(d => {
    const source = d.investment || '未填写需求方';
    const pool = matchDemandBudgetPool(d, budget?.pools || []);
    const key = source;
    const row = rows.get(key) || { source, demandCount: 0, budgetAmount: 0, executionCost: 0, executionDays: 0, acquired: 0, committed: 0, overdue: 0, noBudgetCount: 0, matchedPoolNames: new Set(), demandIds: [] };
    const budgetAmount = getDemandWorkloadCostWan(d, personnel);
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

function buildBudgetRiskRows(demands, budget, personnel = []) {
  const dayCost = getBudgetDayCost(budget);
  const poolRows = buildBudgetPoolRows(demands, budget, personnel);
  const poolRowById = new Map(poolRows.map(row => [String(row.id), row]));
  return demands.map(d => {
    const budgetStatus = getDashboardBudgetStatus(d);
    const days = toNumber(d.days);
    const actualBudget = getDemandWorkloadCostWan(d, personnel);
    const missingPersonnelCost = !hasWorkloadAssignmentCost(d, personnel);
    const estimatedCost = days * dayCost;
    const pool = matchDemandBudgetPool(d, budget?.pools || []);
    const poolRow = pool ? poolRowById.get(String(pool.id)) : null;
    const row = {
      ...d,
      days,
      budget: actualBudget,
      estimatedCost,
      budgetGap: Math.max(0, estimatedCost - actualBudget),
      workloadCost: actualBudget,
      missingPersonnelCost,
      personnelWorkloadText: formatWorkloadAssignments(d, personnel),
      settlementDays: toNumber(d.settlementDays),
      dashboardBudgetStatus: budgetStatus,
      budgetStatusLabel: budgetStatus,
      month: d.landingDate ? String(d.landingDate).slice(0, 7) : '未排期',
      daysToLanding: getDaysTo(d.landingDate),
      daysToBudgetEta: getDaysTo(d.budgetEta),
      budgetPoolName: pool?.name || unmatchedBudgetPoolName,
      matchedBudgetPool: Boolean(pool),
      budgetSourceType: d.budgetSourceType || '部门基线',
      budgetSource: d.budgetSourceType === '其他' ? (d.budgetSource || '') : '',
      poolRemaining: poolRow ? poolRow.amount - (poolRow.demandBudget - actualBudget) : 0,
      poolOverAmount: Math.max(0, actualBudget - (poolRow ? poolRow.amount - (poolRow.demandBudget - actualBudget) : 0)),
      demandPoolOverAmount: Math.max(0, actualBudget - (poolRow ? poolRow.amount - (poolRow.demandBudget - actualBudget) : 0)),
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
  const headers = ['需求ID', '名称', '状态', '计划落地', '距落地天数', '人力', '预算来源', '其他预算来源', '工作量成本w', '人员工作量明细', '预算状态', '预算池', '预算池剩余w', '预算池状态', '超额金额w', '风险等级', '命中规则', '风险说明', '建议操作', '预算缺口w'];
  const lines = [headers.join(',')].concat(rows.map(r => [r.demandNo || r.rr || r.id, r.title, r.status, r.landingDate, Number.isFinite(r.daysToLanding) ? r.daysToLanding : '', r.days, r.budgetSourceType, r.budgetSource, toNumber(r.workloadCost ?? r.budget).toFixed(1), r.personnelWorkloadText || '', r.budgetStatusLabel, r.budgetPoolName, toNumber(r.poolRemaining).toFixed(1), r.poolStatus, toNumber(r.poolOverAmount).toFixed(1), r.riskText, r.triggeredRules.map(rule => rule.name).join('；'), r.riskReason, r.action, r.budgetGap.toFixed(1)].map(v => `"${String(v ?? '').replaceAll('"','""')}"`).join(',')));
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

function buildBudgetSourceExecutionRows(demands, budget, personnel = []) {
  return buildBudgetPoolRows(demands, budget, personnel).map(row => ({
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
    ['需求映射明细', ['需求ID','名称','需求BA','需求PM','预算来源','状态','执行阶段','计划落地月份','原预估人天','决算人力','结算人力','预算执行人天','历史/参考预算金额w','执行成本w','预算状态','预算接口人','是否预算不足'], demandRows.map(r => [r.demandId,r.title,r.demandBA,r.demandPM,r.budgetSource,r.status,r.executionStage,r.month,r.originalDays,r.finalDays,r.settlementDays,r.executionDays,r.budgetAmount,r.executionCost.toFixed(1),r.budgetStatusLabel,r.budgetContact,r.budgetInsufficient?'是':'否'])]
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
    ['月度节奏', ['月份','需求数','历史/参考预算金额w','已获取w','已承诺未获取w','获取超期w','无预算需求数','涉及需求方','涉及PM'], monthRows.map(r => [r.month,r.demandCount,r.budgetAmount.toFixed(1),r.acquired.toFixed(1),r.committed.toFixed(1),r.overdue.toFixed(1),r.noBudget,r.requestersText,r.pmsText])],
    ['需求方汇总', ['需求方','需求数','预算计划w','已获取w','待获取w','无预算需求数','获取超期数','最近计划获取月份'], groupRows.map(r => [r.source,r.demandCount,r.budgetPlan.toFixed(1),r.acquired.toFixed(1),r.pending.toFixed(1),r.noBudgetCount,r.overdueCount,r.latestPlanMonth])],
    ['需求明细', ['需求ID','名称','类型','需求方','需求BA','需求PM','历史/参考预算金额w','预算状态','预算获取日期','预算承诺日期','计划落地日期','预算接口人','预算计划月份','节奏状态'], demandRows.map(r => [r.demandId,r.title,r.source,r.investment,r.demandBA,r.demandPM,r.budgetAmount,r.budgetStatusLabel,r.budgetAcquiredDate,r.budgetEta,r.landingDate,r.budgetContact,r.budgetPlanMonth,r.cadenceStatus])]
  ];
  const lines = sections.flatMap(([title, headers, rows]) => ['', title, headers.join(','), ...rows.map(row => row.map(quote).join(','))]).slice(1);
  const blob = new Blob(['\ufeff' + lines.join('\n')], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'budget-plan-analysis.csv'; a.click();
}


const initialDemands = [];

function createEmptyDemand() {
  return {
    demandKind: 'RR', title: '', demandNo: '', source: '产品立项规划', investment: baselineDemandParty, budgetSourceType: '部门基线', budgetSource: '', budgetPoolId: '', pain: '', goal: '', value: '', acceptanceCriteria: '', requester: '', demandBA: '', demandPM: '', review: '待评审', status: '分析中',
    rr: '', ir: '', irNo: '', parentRrId: '', parentRrNo: '', featureId: '', featureCode: '', featureWorkload: 0, analysisStage: '分析中', analysisConclusion: '', priority: '高', version: 'V2026.08', landingDate: '2026-08-31', poPeriod: getCurrentMonthKey(), days: '', baseWorkloadDays: '', integrationPointWorkloads: [],
    analysis: 0, frontend: 0, middle: 0, backend: 0, workloadMode: 'total', workloadAssignments: [], finalDays: 0, settlementDays: 0, funded: true, budget: 0, budgetStatus: '已承诺未获取', budgetContact: '', budgetEta: '', budgetAcquiredDate: '', committed: true
  };
}

const priorityScore = { 紧急: 100, 高: 70, 一般: 35 };
const sourceScore = { 临时紧急需求: 25, 重要用户: 20, DFx需求: 16, 产品立项规划: 12, '存量运营维护/差评/零星需求': 10 };
const reviewScore = { 通过: 20, 评审通过: 20, 建议推进: 14, 待评审: 0, 不通过: -40 };
const statusScore = { 已驳回: -20, 已提交: 2, 分析中: 6, 已分析: 9, 已排期: 12, 开发中: 18, 已上线: 16, 已验收: 20 };
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
    supplier: supplierOptions[idx % supplierOptions.length],
    personnelType: isTm ? 'TM' : 'OD',
    entryDate: `2025-${String((idx % 12) + 1).padStart(2, '0')}-01`,
    dailyCost: 1481.48,
    monthlyDays: 22.5
  };
});

const defaultBudget = { annualBudget: 683, consumedCost: 712, dayCost: 0.12, monthlyWorkdays: 22.5, annualWorkdays: 270, pools: [
  { id: 'pool-baseline', name: baselineDemandParty, ownerDept: baselineDemandParty, type: 'department-baseline', month: '', amount: 683, description: '部门基线、OBP、存量运营和差评类预算池', sourceType: '部门基线', sourceName: baselineDemandParty, sourceOwner: baselineDemandParty, sourceCode: '', approvedAt: '', sourceNote: '' },
  ...otherBudgetSourceOptions.map((name, idx) => ({ id: `pool-other-${idx + 1}`, name: `${name}预算池`, ownerDept: name, type: 'other', month: '', amount: 0, description: '其他预算来源，按需维护金额', sourceType: '其他', sourceName: name, sourceOwner: name, sourceCode: '', approvedAt: '', sourceNote: '' }))
], scenarios: [
  { name: '极限低预算', addedBudget: 40, description: '仅获得少量追加预算，基本只能覆盖部分超支' },
  { name: '保守预算', addedBudget: 80, description: '获得低位预算假设' },
  { name: '中性预算', addedBudget: 160, description: '获得中位预算假设' },
  { name: '积极预算', addedBudget: 260, description: '获得高位预算假设' }
]};

function normalizePersonnel(p, idx = 0) {
  return {
    id: p.id || Date.now() + idx,
    name: p.name || '',
    employeeNo: p.employeeNo || '',
    owner: p.owner || '',
    position: personnelPositionOptions.includes(p.position) ? p.position : '后端',
    location: p.location || '',
    supplier: normalizePersonnelSupplier(p.supplier, idx),
    personnelType: inferPersonnelType(p),
    entryDate: p.entryDate || '',
    dailyCost: toNumber(p.dailyCost || 0),
    monthlyDays: toNumber(p.monthlyDays || 22.5) || 22.5
  };
}

function createDefaultFeatureManagement() {
  return { levels: Object.fromEntries(featureLevelKeys.map(key => [key, ''])), rows: [] };
}

function findFeature(features, featureId, featureCode) {
  const rows = Array.isArray(features?.rows) ? features.rows : [];
  return rows.find(row => String(row.id) === String(featureId || '')) || rows.find(row => String(row.code || '').trim() === String(featureCode || '').trim()) || null;
}

function getFeaturePath(features, feature) {
  return featureLevelKeys.map(key => feature?.[key]).filter(Boolean).join(' / ');
}

function getFeatureLabel(features, featureId, featureCode) {
  const feature = findFeature(features, featureId, featureCode);
  if (!feature) return featureCode || '-';
  const path = getFeaturePath(features, feature);
  return `${feature.code || feature.id}${path ? ` - ${path}` : ''}`;
}

function normalizeFeatureRow(row = {}, idx = 0) {
  return {
    id: row.id || `feature-${Date.now()}-${idx}`,
    code: row.code || row.featureCode || row['特性编码'] || '',
    ...Object.fromEntries(featureLevelKeys.map(key => [key, row[key] || row[key.toUpperCase()] || ''])),
    owner: row.owner || row['负责人'] || '',
    status: featureStatusOptions.includes(row.status) ? row.status : '启用',
    description: row.description || row['描述'] || ''
  };
}

function normalizeFeatureManagement(raw = createDefaultFeatureManagement()) {
  const base = createDefaultFeatureManagement();
  const levels = { ...base.levels, ...(raw.levels || {}) };
  featureLevelKeys.forEach(key => { levels[key] = String(levels[key] || '').trim(); });
  const rows = (Array.isArray(raw.rows) ? raw.rows : []).map(normalizeFeatureRow).filter(row => row.code || featureLevelKeys.some(key => row[key]));
  return { levels, rows };
}

function getFeatureLevelLabel(features, key) {
  return features?.levels?.[key] || key.toUpperCase();
}

const defaultIntegrationPointRows = [
  ['运行服务', '运维管理', 'WeITSM'],
  ['运行服务', '运维管理', 'WePAM'],
  ['运行服务', '统一客服', 'WeCare'],
  ['运行服务', '体验观测', 'WeEM'],
  ['运行服务', '运行自动化', 'WeWork'],
  ['运行服务', '运行自动化', 'WeFIRE']
].map(([product, subProduct, itService], idx) => ({ id: `ip-default-${idx + 1}`, product, subProduct, itService, module: '', description: '' }));
function createDefaultIntegrationPointCatalog() { return { rows: defaultIntegrationPointRows }; }
function normalizeIntegrationPointRow(row = {}, idx = 0) {
  return {
    id: row.id || `ip-${Date.now()}-${idx}`,
    product: String(row.product || row['产品'] || '').trim(),
    subProduct: String(row.subProduct || row['子产品'] || '').trim(),
    itService: String(row.itService || row['IT产品服务'] || row['IT产品/服务'] || '').trim(),
    module: String(row.module || row['模块'] || '').trim(),
    description: row.description || row['描述'] || ''
  };
}
function normalizeIntegrationPointCatalog(raw = createDefaultIntegrationPointCatalog()) {
  const rows = (Array.isArray(raw.rows) ? raw.rows : []).map(normalizeIntegrationPointRow).filter(row => row.product || row.subProduct || row.itService || row.module);
  const keys = new Set(rows.map(row => `${row.product}|${row.subProduct}|${row.itService || ''}|${row.module || ''}`));
  const missingDefaults = defaultIntegrationPointRows.filter(row => !keys.has(`${row.product}|${row.subProduct}|${row.itService || ''}|${row.module || ''}`));
  return { rows: [...rows, ...missingDefaults] };
}
function findIntegrationPoint(catalog, id, product, subProduct, itService = '', module = '') {
  const rows = Array.isArray(catalog?.rows) ? catalog.rows : [];
  return rows.find(row => String(row.id) === String(id || '')) || rows.find(row => row.product === product && row.subProduct === subProduct && (row.itService || '') === (itService || '') && (row.module || '') === (module || '')) || null;
}
function getIntegrationPointLabel(row) { return row ? [row.product, row.subProduct, row.itService, row.module].filter(Boolean).join(' / ') : '-'; }

function normalizePurchaseOrder(po = {}, idx = 0) {
  const personnelSnapshot = Array.isArray(po.personnelSnapshot) ? po.personnelSnapshot.map(item => ({
    ...item,
    supplier: normalizeSupplier(item.supplier),
    personnelType: normalizePersonnelType(item.personnelType),
    dailyCost: toNumber(item.dailyCost),
    manDays: toNumber(item.manDays),
    cost: toNumber(item.cost)
  })) : [];
  const startDate = po.startDate || '';
  return {
    id: po.id || `po-${Date.now()}-${idx}`,
    poNo: po.poNo || `PO${String(startDate || getCurrentDateKey()).replaceAll('-', '')}${String(idx + 1).padStart(4, '0')}`,
    createdAt: po.createdAt || new Date().toISOString(),
    supplier: normalizeSupplier(po.supplier),
    personnelType: poPersonnelTypeOptions.includes(po.personnelType) ? po.personnelType : normalizePersonnelType(po.personnelType),
    startDate,
    endDate: po.endDate || '',
    poPeriod: po.poPeriod || (startDate ? String(startDate).slice(0, 7) : getCurrentMonthKey()),
    effectiveWorkdays: toNumber(po.effectiveWorkdays),
    totalManDays: toNumber(po.totalManDays),
    estimatedTotalCost: toNumber(po.estimatedTotalCost),
    selectedPersonnelIds: Array.isArray(po.selectedPersonnelIds) ? po.selectedPersonnelIds.map(String) : personnelSnapshot.map(item => String(item.id)),
    personnelSnapshot,
    demandLinks: Array.isArray(po.demandLinks) ? po.demandLinks : [],
    note: po.note || ''
  };
}

function makePurchaseOrderNo(existingOrders = [], index = 0) {
  const today = getCurrentDateKey().replaceAll('-', '');
  const used = new Set(existingOrders.map(order => order.poNo));
  let seq = existingOrders.filter(order => String(order.poNo || '').startsWith(`PO${today}`)).length + 1 + index;
  let poNo = `PO${today}${String(seq).padStart(4, '0')}`;
  while (used.has(poNo)) poNo = `PO${today}${String(++seq).padStart(4, '0')}`;
  return poNo;
}

function buildPurchaseOrderDemandLinks(demands = [], personnelIds = [], poPeriod, personnel = []) {
  const selected = new Set(personnelIds.map(String));
  return buildPersonnelDemandLinks(personnel, demands, poPeriod).filter(link => selected.has(String(link.personnelId))).map(link => ({
    demandId: link.demandId,
    demandKey: link.demandKey,
    title: link.title,
    status: link.status,
    priority: link.priority,
    landingDate: link.landingDate,
    personnelId: link.personnelId,
    personName: link.personName,
    employeeNo: link.employeeNo,
    role: link.role,
    days: link.days,
    cost: link.cost
  }));
}

function buildPoIssueGroups({ personnel = [], selectedIds = [], manDayOverrides = {}, effectiveWorkdays = 0 }) {
  const selected = new Set(selectedIds.map(String));
  return poPersonnelTypeOptions.map(type => {
    const people = personnel.filter(p => selected.has(String(p.id)) && normalizePersonnelType(p.personnelType) === type).map(p => {
      const manDays = toNumber(manDayOverrides[String(p.id)] ?? effectiveWorkdays);
      const cost = manDays * toNumber(p.dailyCost) / 10000;
      return { ...p, manDays, cost };
    }).filter(p => p.manDays > 0 && toNumber(p.dailyCost) > 0);
    return { personnelType: type, people, totalManDays: people.reduce((s, p) => s + p.manDays, 0), estimatedTotalCost: people.reduce((s, p) => s + p.cost, 0) };
  }).filter(group => group.people.length);
}

function buildPurchaseOrderSummary(purchaseOrders = []) {
  const base = { count: purchaseOrders.length, manDays: 0, cost: 0, byType: { TM: { count: 0, manDays: 0, cost: 0 }, OD: { count: 0, manDays: 0, cost: 0 } } };
  purchaseOrders.forEach(order => {
    const type = poPersonnelTypeOptions.includes(order.personnelType) ? order.personnelType : 'OD';
    base.manDays += toNumber(order.totalManDays);
    base.cost += toNumber(order.estimatedTotalCost);
    base.byType[type].count += 1;
    base.byType[type].manDays += toNumber(order.totalManDays);
    base.byType[type].cost += toNumber(order.estimatedTotalCost);
  });
  return base;
}

function buildBudgetPoRelationSummary({ demands = [], budget, purchaseOrders = [] }) {
  const budgetPoolAmount = (budget?.pools || []).reduce((sum, pool) => sum + getBudgetPoolAmount(pool), 0);
  const demandExecutionCost = demands.reduce((sum, demand) => sum + getDemandExecutionCost(demand, budget), 0);
  const poSummary = buildPurchaseOrderSummary(purchaseOrders);
  const settlementCost = demands.reduce((sum, demand) => sum + toNumber(demand.settlementDays) * getBudgetDayCost(budget), 0);
  return { budgetPoolAmount, demandExecutionCost, poCost: poSummary.cost, settlementCost, budgetPoDiff: budgetPoolAmount - poSummary.cost, demandPoDiff: demandExecutionCost - poSummary.cost, poSettlementDiff: poSummary.cost - settlementCost, poSummary };
}

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
  const normalizedPools = rawPools.map((pool, idx) => {
    const isBaseline = isDepartmentBaselinePool(pool);
    const name = demandPartyAliases[pool.name] || pool.name || `预算池${idx + 1}`;
    const ownerDept = demandPartyAliases[pool.ownerDept || pool.owner] || pool.ownerDept || pool.owner || '';
    const matchedOtherSource = otherBudgetSourceOptions.find(source => [name, ownerDept].some(value => String(value || '').includes(source)));
    return {
      id: pool.id || `pool-${Date.now()}-${idx}`,
      name: isBaseline ? baselineDemandParty : name,
      ownerDept: isBaseline ? baselineDemandParty : ownerDept,
      type: isBaseline ? 'department-baseline' : matchedOtherSource ? 'other' : budgetPoolTypeLabels[pool.type] ? pool.type : 'other',
      month: pool.month || '',
      amount: Math.max(0, toNumber(pool.amount ?? pool.budget ?? 0)),
      description: pool.description || '',
      sourceType: pool.sourceType || '',
      sourceName: pool.sourceName || '',
      sourceOwner: pool.sourceOwner || '',
      sourceCode: pool.sourceCode || '',
      approvedAt: pool.approvedAt || '',
      sourceNote: pool.sourceNote || ''
    };
  });
  otherBudgetSourceOptions.forEach((name, idx) => {
    if (!normalizedPools.some(pool => pool.type === 'other' && [pool.name, pool.ownerDept].some(value => String(value || '').includes(name)))) {
      normalizedPools.push({ id: `pool-other-${idx + 1}`, name: `${name}预算池`, ownerDept: name, type: 'other', month: '', amount: 0, description: '其他预算来源，按需维护金额', sourceType: '其他', sourceName: name, sourceOwner: name, sourceCode: '', approvedAt: '', sourceNote: '' });
    }
  });
  return {
    ...merged,
    annualBudget: toNumber(merged.annualBudget),
    consumedCost: toNumber(merged.consumedCost),
    dayCost: toNumber(merged.dayCost || merged.costPerDay || defaultBudget.dayCost),
    monthlyWorkdays: toNumber(merged.monthlyWorkdays || defaultBudget.monthlyWorkdays),
    annualWorkdays: toNumber(merged.annualWorkdays || defaultBudget.annualWorkdays),
    scenarios: Array.isArray(merged.scenarios) ? merged.scenarios.map(item => ({ ...item, addedBudget: toNumber(item.addedBudget) })) : defaultBudget.scenarios,
    pools: normalizedPools
  };
}

const appPageIds = ['demands', 'features', 'integrationPoints', 'personnel', 'purchaseOrders', 'budgetManage', 'budget', 'budgetRisk', 'budgetExecution', 'workCalendar', 'manual'];
const getInitialPage = () => {
  const hashPage = window.location.hash.replace(/^#\/?/, '');
  const pathPage = window.location.pathname.replace(/^\//, '').split('/')[0];
  return appPageIds.includes(hashPage) ? hashPage : appPageIds.includes(pathPage) ? pathPage : 'demands';
};

function App() {
  const [page, setPageState] = useState(getInitialPage);
  const [poPeriodFromCalendar, setPoPeriodFromCalendar] = useState('');
  const setPage = nextPage => {
    setPageState(nextPage);
    if (appPageIds.includes(nextPage)) window.history.replaceState(null, '', `/#${nextPage}`);
  };
  if (localStorage.getItem('wfp.demandsCleared') !== '2026-06-21') {
    localStorage.setItem('wfp.demands', JSON.stringify([]));
    localStorage.setItem('wfp.demandsCleared', '2026-06-21');
  }
  const [demands, setDemands] = useState(() => loadStored('wfp.demands', initialDemands).map(d => normalizeDemand({ ...d, landingDate: d.landingDate || '' })));
  const [personnel, setPersonnel] = useState(() => loadStored('wfp.personnel', defaultPersonnel).map(normalizePersonnel));
  const [budget, setBudget] = useState(() => normalizeBudget(loadStored('wfp.budget', defaultBudget)));
  const [purchaseOrders, setPurchaseOrders] = useState(() => loadStored('wfp.purchaseOrders', []).map(normalizePurchaseOrder));
  const [features, setFeatures] = useState(() => normalizeFeatureManagement(loadStored('wfp.features', createDefaultFeatureManagement())));
  const [integrationPoints, setIntegrationPoints] = useState(() => normalizeIntegrationPointCatalog(loadStored('wfp.integrationPoints', createDefaultIntegrationPointCatalog())));
  React.useEffect(() => localStorage.setItem('wfp.demands', JSON.stringify(demands)), [demands]);
  React.useEffect(() => localStorage.setItem('wfp.personnel', JSON.stringify(personnel)), [personnel]);
  React.useEffect(() => localStorage.setItem('wfp.budget', JSON.stringify(budget)), [budget]);
  React.useEffect(() => localStorage.setItem('wfp.purchaseOrders', JSON.stringify(purchaseOrders)), [purchaseOrders]);
  React.useEffect(() => localStorage.setItem('wfp.features', JSON.stringify(features)), [features]);
  React.useEffect(() => localStorage.setItem('wfp.integrationPoints', JSON.stringify(integrationPoints)), [integrationPoints]);
  React.useEffect(() => {
    const syncPageFromHash = () => {
      const hashPage = window.location.hash.replace(/^#\/?/, '');
      if (appPageIds.includes(hashPage)) setPageState(hashPage);
    };
    window.addEventListener('hashchange', syncPageFromHash);
    return () => window.removeEventListener('hashchange', syncPageFromHash);
  }, []);
  const workloadDemands = useMemo(() => getWorkloadBearingDemands(demands), [demands]);
  const totalDays = workloadDemands.reduce((s, d) => s + toNumber(d.days), 0);
  const unfundedDays = workloadDemands.filter(d => !hasBudget(d)).reduce((s, d) => s + toNumber(d.days), 0);
  const openDemand = id => { setPage('demands'); setTimeout(() => window.dispatchEvent(new CustomEvent('wfp.openDemand', { detail: id })), 0); };
  const openDemandFilter = (key, value) => { setPage('demands'); setTimeout(() => window.dispatchEvent(new CustomEvent('wfp.filterDemands', { detail: { key, value } })), 0); };
  const openDemandIds = (ids, label) => { setPage('demands'); setTimeout(() => window.dispatchEvent(new CustomEvent('wfp.filterDemandIds', { detail: { ids, label } })), 0); };
  const openBudgetRiskIds = (ids, label) => { setPage('budget'); setTimeout(() => window.dispatchEvent(new CustomEvent('wfp.filterRiskDemandIds', { detail: { ids, label } })), 0); };
  const openPoIssue = period => { setPoPeriodFromCalendar(period || getCurrentMonthKey()); setPage('personnel'); };
  const openPurchaseOrders = () => setPage('purchaseOrders');
  const nav = [
    ['demands', FileText, '需求管理'], ['features', Tags, '特性管理'], ['integrationPoints', Network, '集成点管理'], ['personnel', Users, '人员管理'], ['purchaseOrders', ClipboardList, 'PO管理'], ['budgetManage', Settings, '预算管理'], ['budget', PieChart, '预算与风险分析'], ['workCalendar', CalendarDays, '人力日历'], ['manual', BookOpen, '操作手册']
  ];
  return <div className="app">
    <aside><div className="brand"><BarChart3 size={28}/><div><b>需求及人力规划</b><span>Workforce Planning</span></div></div>{nav.map(([id, Icon, label]) => <button key={id} className={page===id?'active':''} onClick={()=>setPage(id)}><Icon size={18}/>{label}</button>)}</aside>
    <main>
      {page === 'demands' && <DemandPool demands={demands} setDemands={setDemands} budget={budget} personnel={personnel} features={features} integrationPoints={integrationPoints} totalDays={totalDays} unfundedDays={unfundedDays}/>}
      {page === 'features' && <FeatureManagementPage features={features} setFeatures={setFeatures}/>}
      {page === 'integrationPoints' && <IntegrationPointManagementPage integrationPoints={integrationPoints} setIntegrationPoints={setIntegrationPoints}/>}
      {page === 'personnel' && <Personnel personnel={personnel} setPersonnel={setPersonnel} demands={workloadDemands} budget={budget} openDemand={openDemand} openDemandIds={openDemandIds} initialPoPeriod={poPeriodFromCalendar}/>}
      {page === 'purchaseOrders' && <PurchaseOrderManagementPage purchaseOrders={purchaseOrders} setPurchaseOrders={setPurchaseOrders}/>}
      {page === 'budgetManage' && <BudgetManagementPage demands={workloadDemands} budget={budget} setBudget={setBudget} personnel={personnel} openDemandIds={openDemandIds}/>}
      {['budget', 'budgetRisk', 'budgetExecution'].includes(page) && <BudgetRiskAnalysisPage demands={workloadDemands} budget={budget} setBudget={setBudget} personnel={personnel} purchaseOrders={purchaseOrders} openDemand={openDemand} openDemandFilter={openDemandFilter} openDemandIds={openDemandIds}/>}
      {page === 'workCalendar' && <WorkCalendarPage personnel={personnel} demands={workloadDemands} purchaseOrders={purchaseOrders} setPurchaseOrders={setPurchaseOrders} onOpenPurchaseOrders={openPurchaseOrders} onIssuePo={openPoIssue}/>}
      {page === 'manual' && <Manual/>}
      <button className="reset-floating" onClick={()=>{ if (confirm('确认恢复初始示例数据？当前导入和修改的数据会被清空。')) { localStorage.removeItem('wfp.demands'); localStorage.removeItem('wfp.personnel'); localStorage.removeItem('wfp.budget'); localStorage.removeItem('wfp.purchaseOrders'); localStorage.removeItem('wfp.features'); localStorage.removeItem('wfp.integrationPoints'); location.reload(); }}}>恢复初始数据</button>
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

function FeatureManagementPage({ features, setFeatures }) {
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('全部');
  const [importMsg, setImportMsg] = useState('');
  const [importDraft, setImportDraft] = useState(null);
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [levelDraft, setLevelDraft] = useState(() => ({ ...features.levels }));
  const [editingFeatureId, setEditingFeatureId] = useState(null);
  const [featureDraft, setFeatureDraft] = useState(null);
  const [featureEditError, setFeatureEditError] = useState('');
  const query = keyword.trim().toLowerCase();
  const filteredRows = features.rows.filter(row => {
    const text = [row.code, ...featureLevelKeys.map(key => row[key]), row.owner, row.status, row.description].join(' ').toLowerCase();
    return (!query || text.includes(query)) && (statusFilter === '全部' || row.status === statusFilter);
  });
  const nextFeatureCode = () => {
    const used = new Set(features.rows.map(row => row.code));
    let idx = features.rows.length + 1;
    while (used.has(`F${String(idx).padStart(3, '0')}`)) idx += 1;
    return `F${String(idx).padStart(3, '0')}`;
  };
  const openLevelModal = () => { setLevelDraft({ ...features.levels }); setShowLevelModal(true); };
  const closeLevelModal = () => setShowLevelModal(false);
  const saveLevels = () => {
    setFeatures(current => normalizeFeatureManagement({ ...current, levels: { ...current.levels, ...levelDraft } }));
    closeLevelModal();
  };
  const openNewFeature = () => {
    setEditingFeatureId('new');
    setFeatureDraft(normalizeFeatureRow({ id: `feature-${Date.now()}`, code: nextFeatureCode(), status: '启用' }));
    setFeatureEditError('');
  };
  const openEditFeature = row => {
    const normalized = normalizeFeatureRow(row);
    setEditingFeatureId(row.id);
    setFeatureDraft(normalized);
    setFeatureEditError('');
  };
  const closeFeatureModal = () => {
    setEditingFeatureId(null);
    setFeatureDraft(null);
    setFeatureEditError('');
  };
  const setFeatureDraftField = (key, value) => {
    setFeatureDraft(draft => draft ? normalizeFeatureRow({ ...draft, [key]: value }) : draft);
    setFeatureEditError('');
  };
  const saveFeature = () => {
    const normalized = normalizeFeatureRow(featureDraft || {});
    if (!normalized.code && !featureLevelKeys.some(key => normalized[key])) {
      setFeatureEditError('请填写特性编码，或至少填写一个层级路径。');
      return;
    }
    setFeatures(current => editingFeatureId === 'new'
      ? { ...current, rows: [normalized, ...current.rows] }
      : { ...current, rows: current.rows.map(row => row.id === editingFeatureId ? { ...normalized, id: row.id } : row) });
    closeFeatureModal();
  };
  const deleteRow = id => {
    if (confirm('确认删除该特性？')) {
      setFeatures(current => ({ ...current, rows: current.rows.filter(row => row.id !== id) }));
      if (editingFeatureId === id) closeFeatureModal();
    }
  };
  const display = value => value || '-';
  const onImport = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length < 2) throw new Error('CSV至少需要表头和一行数据');
      const headers = rows[0].map(h => h.trim()).filter(Boolean);
      const previewRows = rows.slice(1).filter(row => row.some(cell => String(cell ?? '').trim() !== '')).slice(0, 5);
      setImportDraft({ text, headers, mapping: guessFeatureImportMapping(headers, features), previewRows });
      setImportMsg('已读取文件，请确认字段映射后导入');
    } catch (err) {
      setImportMsg(`导入失败：${err.message}`);
    } finally {
      event.target.value = '';
    }
  };
  const updateImportMapping = (key, header) => setImportDraft(draft => ({ ...draft, mapping: { ...draft.mapping, [key]: header } }));
  const importPreviewValue = (row, key) => {
    const header = importDraft?.mapping?.[key];
    const idx = importDraft?.headers?.indexOf(header);
    return idx >= 0 ? (row[idx] || '') : '';
  };
  const confirmImport = () => {
    try {
      const imported = parseFeatureCsv(importDraft.text, importDraft.mapping, features);
      if (!imported.length) throw new Error('没有可导入的特性行');
      setFeatures(current => ({ ...current, rows: [...current.rows, ...imported.map((row, idx) => ({ ...row, id: `feature-${Date.now()}-${idx}` }))] }));
      setImportDraft(null);
      setImportMsg(`已导入 ${imported.length} 条特性`);
    } catch (err) {
      setImportMsg(`导入失败：${err.message}`);
    }
  };
  return <>
    <Header title="特性管理" desc="维护 L1-L7 特性层级定义、层级别名和特性清单。"/>
    <div className="toolbar demand-toolbar">
      <div className="actions"><input className="search-input" placeholder="搜索编码、层级、负责人、描述" value={keyword} onChange={e=>setKeyword(e.target.value)}/><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option>全部</option>{featureStatusOptions.map(item => <option key={item}>{item}</option>)}</select></div>
    </div>
    <div className="toolbar demand-table-toolbar">
      <div className="actions"><button onClick={openNewFeature}>新增特性</button></div>
      <div className="actions"><button onClick={openLevelModal}>层级别名维护</button><button onClick={()=>downloadFeatureTemplate(features)}>下载模板</button><label className="import-btn">导入<input type="file" accept=".csv,text/csv" onChange={onImport}/></label><button onClick={()=>downloadFeatureCsv(features)}>导出</button></div>
    </div>
    {importMsg && <div className="notice">{importMsg}</div>}
    {importDraft && <section className="card import-mapping-card"><h2>导入字段映射</h2><p className="muted">系统已按标准字段名、中文别名和当前层级别名推荐映射，可调整后再导入。</p><div className="import-mapping-table"><table><thead><tr>{featureImportFields.map(([key, label]) => <th key={key} title={getFeatureImportLabel(features, key, label)}><span>{getFeatureImportLabel(features, key, label)}</span></th>)}</tr><tr>{featureImportFields.map(([key]) => <th key={key}><select title={importDraft.mapping[key] || '不导入'} value={importDraft.mapping[key] || ''} onChange={e=>updateImportMapping(key, e.target.value)}><option value="">不导入</option>{importDraft.headers.map(header => <option key={header} value={header} title={header}>{header}</option>)}</select></th>)}</tr></thead><tbody>{importDraft.previewRows?.length ? importDraft.previewRows.map((row, idx) => <tr key={idx}>{featureImportFields.map(([key]) => { const value = importPreviewValue(row, key); return <td key={key} title={value}>{value}</td>; })}</tr>) : <tr><td colSpan={featureImportFields.length}>没有可预览的数据行</td></tr>}</tbody></table></div><div className="modal-actions"><button className="secondary" onClick={()=>setImportDraft(null)}>取消</button><button className="primary inline" onClick={confirmImport}>按映射导入</button></div></section>}
    <div className="scroll-hint">表格可横向拖动查看全部字段，列宽可拖拽调整</div>
    <div className="card table-card demand-table-card feature-table-card"><table><thead><tr><th>特性编码</th>{featureLevelKeys.map(key => <th key={key}>{getFeatureLevelLabel(features, key)}</th>)}<th>负责人</th><th>状态</th><th>描述</th><th>操作</th></tr></thead><tbody>{filteredRows.length ? filteredRows.map(row => <tr key={row.id}><td><button className="title-link" onClick={()=>openEditFeature(row)}>{row.code || '未填写编码'}</button></td>{featureLevelKeys.map(key => <td key={key}>{display(row[key])}</td>)}<td>{display(row.owner)}</td><td>{display(row.status)}</td><td><span className="readonly-text-cell">{display(row.description)}</span></td><td><button className="link neutral" onClick={()=>openEditFeature(row)}>详情</button><button className="link" onClick={()=>deleteRow(row.id)}>删除</button></td></tr>) : <tr><td colSpan={featureLevelKeys.length + 5}>暂无特性数据</td></tr>}</tbody></table></div>
    {showLevelModal && <div className="modal-backdrop" onClick={closeLevelModal}><div className="modal-card feature-edit-modal" onClick={e=>e.stopPropagation()}><div className="modal-header"><h2>层级别名维护</h2><button className="link neutral" onClick={closeLevelModal}>关闭</button></div><div className="feature-level-grid">{featureLevelKeys.map(key => <label key={key}>层级 {key.toUpperCase()}<input value={levelDraft[key] || ''} onChange={e=>setLevelDraft(draft => ({ ...draft, [key]: e.target.value }))} placeholder={`${key.toUpperCase()} 别名`}/></label>)}</div><div className="modal-actions"><button className="secondary" onClick={closeLevelModal}>取消</button><button className="primary inline" onClick={saveLevels}>保存</button></div></div></div>}
    {featureDraft && <div className="modal-backdrop" onClick={closeFeatureModal}><div className="modal-card feature-edit-modal" onClick={e=>e.stopPropagation()}><div className="modal-header"><h2>{editingFeatureId === 'new' ? '新增特性' : '特性详情'}</h2><button className="link neutral" onClick={closeFeatureModal}>关闭</button></div>{featureEditError && <div className="field-error">{featureEditError}</div>}<div className="submit-layout"><section className="submit-section"><h2>基础信息</h2><div className="submit-grid three"><label>特性编码<input value={featureDraft.code || ''} onChange={e=>setFeatureDraftField('code', e.target.value)}/></label><label>负责人<input value={featureDraft.owner || ''} onChange={e=>setFeatureDraftField('owner', e.target.value)}/></label><label>状态<select value={featureDraft.status || '启用'} onChange={e=>setFeatureDraftField('status', e.target.value)}>{featureStatusOptions.map(item => <option key={item}>{item}</option>)}</select></label></div></section><section className="submit-section"><h2>层级路径</h2><div className="submit-grid four">{featureLevelKeys.map(key => <label key={key}>{getFeatureLevelLabel(features, key)}<input value={featureDraft[key] || ''} onChange={e=>setFeatureDraftField(key, e.target.value)}/></label>)}</div></section><section className="submit-section"><h2>描述</h2><div className="submit-grid"><label>描述<textarea value={featureDraft.description || ''} onChange={e=>setFeatureDraftField('description', e.target.value)}/></label></div></section></div><div className="modal-actions"><button className="secondary" onClick={closeFeatureModal}>取消</button><button className="primary inline" onClick={saveFeature}>保存</button></div></div></div>}
  </>;
}


function IntegrationPointManagementPage({ integrationPoints, setIntegrationPoints }) {
  const [keyword, setKeyword] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const [importDraft, setImportDraft] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [editError, setEditError] = useState('');
  const query = keyword.trim().toLowerCase();
  const rows = (integrationPoints.rows || []).filter(row => {
    const text = [row.product, row.subProduct, row.itService, row.module, row.description].join(' ').toLowerCase();
    return !query || text.includes(query);
  });
  const openNew = () => { setEditingId('new'); setDraft(normalizeIntegrationPointRow({ id: `ip-${Date.now()}` })); setEditError(''); };
  const openEdit = row => { setEditingId(row.id); setDraft(normalizeIntegrationPointRow(row)); setEditError(''); };
  const close = () => { setEditingId(null); setDraft(null); setEditError(''); };
  const setField = (key, value) => { setDraft(current => current ? normalizeIntegrationPointRow({ ...current, [key]: value }) : current); setEditError(''); };
  const validateRow = (row, existingRows) => {
    if (!row.product) return '产品必填';
    if (!row.subProduct) return '子产品必填';
    const duplicated = existingRows.some(item => item.id !== editingId && item.product === row.product && item.subProduct === row.subProduct && (item.itService || '') === (row.itService || '') && (item.module || '') === (row.module || ''));
    if (duplicated) return '产品、子产品、IT产品服务、模块组合不能重复';
    return '';
  };
  const save = () => {
    const normalized = normalizeIntegrationPointRow(draft || {});
    const error = validateRow(normalized, integrationPoints.rows || []);
    if (error) { setEditError(error); return; }
    setIntegrationPoints(current => editingId === 'new' ? { ...current, rows: [normalized, ...current.rows] } : { ...current, rows: current.rows.map(row => row.id === editingId ? { ...normalized, id: row.id } : row) });
    close();
  };
  const deleteRow = id => { if (confirm('确认删除该集成点？历史RR中的快照仍会保留。')) setIntegrationPoints(current => ({ ...current, rows: current.rows.filter(row => row.id !== id) })); };
  const onImport = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.length < 2) throw new Error('CSV至少需要表头和一行数据');
      const headers = parsed[0].map(h => h.trim()).filter(Boolean);
      const previewRows = parsed.slice(1).filter(row => row.some(cell => String(cell ?? '').trim() !== '')).slice(0, 5);
      setImportDraft({ text, headers, mapping: guessIntegrationPointImportMapping(headers), previewRows });
      setImportMsg('已读取文件，请确认字段映射后导入');
    } catch (err) { setImportMsg(`导入失败：${err.message}`); }
    finally { event.target.value = ''; }
  };
  const updateImportMapping = (key, header) => setImportDraft(current => ({ ...current, mapping: { ...current.mapping, [key]: header } }));
  const importPreviewValue = (row, key) => { const header = importDraft?.mapping?.[key]; const idx = importDraft?.headers?.indexOf(header); return idx >= 0 ? (row[idx] || '') : ''; };
  const confirmImport = () => {
    try {
      const imported = parseIntegrationPointCsv(importDraft.text, importDraft.mapping);
      const existingKeys = new Set((integrationPoints.rows || []).map(row => `${row.product}|${row.subProduct}|${row.itService || ''}|${row.module || ''}`));
      const seen = new Set();
      imported.forEach((row, idx) => { const key = `${row.product}|${row.subProduct}|${row.itService || ''}|${row.module || ''}`; if (existingKeys.has(key) || seen.has(key)) throw new Error(`第${idx + 2}行集成点重复：${getIntegrationPointLabel(row)}`); seen.add(key); });
      setIntegrationPoints(current => ({ ...current, rows: [...current.rows, ...imported.map((row, idx) => ({ ...row, id: `ip-${Date.now()}-${idx}` }))] }));
      setImportDraft(null); setImportMsg(`已导入 ${imported.length} 条集成点`);
    } catch (err) { setImportMsg(`导入失败：${err.message}`); }
  };
  const display = value => value || '-';
  return <>
    <Header title="集成点管理" desc="维护 RR 工作量评估使用的产品、子产品、IT产品服务和模块目录。"/>
    <div className="toolbar demand-toolbar"><div className="actions"><input className="search-input" placeholder="搜索产品、子产品、IT产品服务、模块、描述" value={keyword} onChange={e=>setKeyword(e.target.value)}/></div></div>
    <div className="toolbar demand-table-toolbar"><div className="actions"><button onClick={openNew}>新增集成点</button></div><div className="actions"><button onClick={downloadIntegrationPointTemplate}>下载模板</button><label className="import-btn">导入<input type="file" accept=".csv,text/csv" onChange={onImport}/></label><button onClick={()=>downloadIntegrationPointCsv(integrationPoints)}>导出</button></div></div>
    {importMsg && <div className="notice">{importMsg}</div>}
    {importDraft && <section className="card import-mapping-card"><h2>导入字段映射</h2><p className="muted">产品和子产品为必填，IT产品服务和模块可选；请确认映射后导入。</p><div className="import-mapping-table"><table><thead><tr>{integrationPointImportFields.map(([key, label]) => <th key={key} title={label}><span className={['product','subProduct'].includes(key) ? 'required-label' : ''}>{label}</span></th>)}</tr><tr>{integrationPointImportFields.map(([key]) => <th key={key}><select value={importDraft.mapping[key] || ''} onChange={e=>updateImportMapping(key, e.target.value)}><option value="">不导入</option>{importDraft.headers.map(header => <option key={header} value={header} title={header}>{header}</option>)}</select></th>)}</tr></thead><tbody>{importDraft.previewRows?.length ? importDraft.previewRows.map((row, idx) => <tr key={idx}>{integrationPointImportFields.map(([key]) => { const value = importPreviewValue(row, key); return <td key={key} title={value}>{value}</td>; })}</tr>) : <tr><td colSpan={integrationPointImportFields.length}>没有可预览的数据行</td></tr>}</tbody></table></div><div className="modal-actions"><button className="secondary" onClick={()=>setImportDraft(null)}>取消</button><button className="primary inline" onClick={confirmImport}>按映射导入</button></div></section>}
    <div className="scroll-hint">表格可横向拖动查看全部字段</div>
    <div className="card table-card demand-table-card integration-point-table-card"><table><thead><tr><th><span className="required-label">产品</span></th><th><span className="required-label">子产品</span></th><th>IT产品服务</th><th>模块</th><th>描述</th><th>操作</th></tr></thead><tbody>{rows.length ? rows.map(row => <tr key={row.id}><td>{display(row.product)}</td><td>{display(row.subProduct)}</td><td>{display(row.itService)}</td><td>{display(row.module)}</td><td><span className="readonly-text-cell">{display(row.description)}</span></td><td><button className="link neutral" onClick={()=>openEdit(row)}>编辑</button><button className="link" onClick={()=>deleteRow(row.id)}>删除</button></td></tr>) : <tr><td colSpan="6">暂无集成点数据</td></tr>}</tbody></table></div>
    {draft && <div className="modal-backdrop" onClick={close}><div className="modal-card feature-edit-modal" onClick={e=>e.stopPropagation()}><div className="modal-header"><h2>{editingId === 'new' ? '新增集成点' : '编辑集成点'}</h2><button className="link neutral" onClick={close}>关闭</button></div>{editError && <div className="field-error">{editError}</div>}<div className="submit-layout"><section className="submit-section"><h2>基础信息</h2><div className="submit-grid four"><label><RequiredLabel>产品</RequiredLabel><input value={draft.product || ''} onChange={e=>setField('product', e.target.value)}/></label><label><RequiredLabel>子产品</RequiredLabel><input value={draft.subProduct || ''} onChange={e=>setField('subProduct', e.target.value)}/></label><label>IT产品服务<input value={draft.itService || ''} onChange={e=>setField('itService', e.target.value)}/></label><label>模块<input value={draft.module || ''} onChange={e=>setField('module', e.target.value)}/></label></div></section><section className="submit-section"><h2>描述</h2><div className="submit-grid"><label>描述<textarea value={draft.description || ''} onChange={e=>setField('description', e.target.value)}/></label></div></section></div><div className="modal-actions"><button className="secondary" onClick={close}>取消</button><button className="primary inline" onClick={save}>保存</button></div></div></div>}
  </>;
}

const demandColumnLabels = {
  title: '需求', demandKind: '层级', demandNo: 'RR单号', parentRrNo: '关联RR', irNo: 'IR单号', featureCode: '关联特性', featureWorkload: '特性工作量', analysisStage: '分析阶段', analysisConclusion: '分析结论', requester: '提出人', demandBA: '需求BA', demandPM: '需求PM', source: '类型', acceptanceCriteria: '验收标准', investment: '需求方', priority: '优先级', landingDate: '计划落地日期', poPeriod: 'PO执行期间', budgetStatus: '预算状态', budgetSourceType: '预算来源', budgetSource: '其他预算来源', budgetAcquiredDate: '预算获取日期', budgetContact: '预算接口人', budgetEta: '预算承诺日期', baseWorkloadDays: '基础工作量', integrationPointSummary: '集成点', integrationPointWorkload: '集成点工作量', days: '预估人天', finalDays: '决算人力', version: '版本', status: '需求状态', settlementDays: '结算人力'
};

function DemandPool({demands, setDemands, budget, personnel = [], features, integrationPoints, totalDays, unfundedDays}) {
  const [filter, setFilter] = useState('全部');
  const [keyword, setKeyword] = useState('');
  const [columnFilters, setColumnFilters] = useState({});
  const [monthStart, setMonthStart] = useState('');
  const [monthEnd, setMonthEnd] = useState('');
  const [dateSort, setDateSort] = useState({ key: '', direction: 'asc' });
  const [filteredIds, setFilteredIds] = useState(null);
  const [filteredIdsLabel, setFilteredIdsLabel] = useState('');
  const [editingDemandId, setEditingDemandId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [editError, setEditError] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const [importDraft, setImportDraft] = useState(null);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [demandView, setDemandView] = useState('RR');
  const hiddenDemandColumnKeys = ['demandBA', 'demandPM', 'acceptanceCriteria'];
  const rrDefaultColumnKeys = ['title','demandNo','requester','source','investment','priority','landingDate','poPeriod','budgetStatus','budgetSourceType','budgetSource','budgetAcquiredDate','budgetContact','budgetEta','baseWorkloadDays','integrationPointSummary','integrationPointWorkload','days','finalDays','version','status','settlementDays'];
  const irDefaultColumnKeys = ['irNo','parentRrNo','title','featureCode','featureWorkload','demandPM','priority','landingDate','poPeriod','status','finalDays','settlementDays'];
  const defaultColumnKeys = ['title','demandNo','requester','source','investment','priority','landingDate','poPeriod','budgetStatus','budgetSourceType','budgetSource','budgetAcquiredDate','budgetContact','budgetEta','baseWorkloadDays','integrationPointSummary','integrationPointWorkload','days','finalDays','version','status','settlementDays','demandKind','parentRrNo','irNo','featureCode','featureWorkload','analysisStage','analysisConclusion','demandBA','demandPM','acceptanceCriteria'];
  const [columnOrder, setColumnOrder] = useState(() => {
    const stored = loadStored('wfp.demandColumnOrder', defaultColumnKeys);
    const shouldResetStoredOrder = stored[1] === 'demandKind' || stored[2] === 'demandNo';
    const visibleStored = (shouldResetStoredOrder ? defaultColumnKeys : stored).filter(key => defaultColumnKeys.includes(key));
    return [...visibleStored, ...defaultColumnKeys.filter(key => !visibleStored.includes(key))];
  });
  const demandViewDefaultColumns = demandView === 'RR' ? rrDefaultColumnKeys : irDefaultColumnKeys;
  const [visibleColumnKeys, setVisibleColumnKeys] = useState(() => {
    const stored = loadStored('wfp.demandVisibleColumns', rrDefaultColumnKeys.filter(key => !hiddenDemandColumnKeys.includes(key)));
    const shouldResetStoredVisible = stored.includes('demandKind') || stored.includes('analysisStage') || stored.includes('featureCode');
    const sourceKeys = shouldResetStoredVisible ? rrDefaultColumnKeys.filter(key => !hiddenDemandColumnKeys.includes(key)) : stored;
    return defaultColumnKeys.filter(key => sourceKeys.includes(key));
  });
  const [draggingColumn, setDraggingColumn] = useState('');
  const [dropTarget, setDropTarget] = useState(null);
  const tableScrollRef = useRef(null);
  const tableRef = useRef(null);
  React.useEffect(() => localStorage.setItem('wfp.demandColumnOrder', JSON.stringify(columnOrder)), [columnOrder]);
  React.useEffect(() => localStorage.setItem('wfp.demandVisibleColumns', JSON.stringify(visibleColumnKeys)), [visibleColumnKeys]);
  React.useEffect(() => setVisibleColumnKeys(demandViewDefaultColumns.filter(key => !hiddenDemandColumnKeys.includes(key))), [demandView]);
  const viewDemands = demands.filter(d => demandView === 'IR' ? isIrDemand(d) : isRrDemand(d));
  const filtered = filter === '全部' ? viewDemands : viewDemands.filter(d => d.priority === filter || d.investment === filter || d.source === filter);
  const monthOptions = useMemo(() => buildMonthOptions(demands), [demands]);
  const monthInRange = d => {
    const month = d.landingDate ? String(d.landingDate).slice(0, 7) : '';
    if (!month) return !monthStart && !monthEnd;
    return (!monthStart || month >= monthStart) && (!monthEnd || month <= monthEnd);
  };
  const monthFiltered = filtered.filter(monthInRange);
  const query = keyword.trim().toLowerCase();
  const fullTextFields = ['title','demandNo','parentRrNo','irNo','featureCode','analysisStage','analysisConclusion','source','acceptanceCriteria','investment','budgetSourceType','budgetSource','requester','version','landingDate','poPeriod','budgetContact','budgetEta','budgetStatus','integrationPointSummary','rr','ir','priority','review','status'];
  const cellText = (d, key) => {
    if (key === 'investment') return d.investment || '未填写需求方';
    if (key === 'budgetSource') return d.budgetSourceType === '其他' ? (d.budgetSource || '-') : '-';
    if (key === 'poPeriod') return formatPoPeriod(getDemandPoPeriod(d));
    if (key === 'demandKind') return getDemandKind(d);
    if (key === 'featureCode') return getFeatureLabel(features, d.featureId, d.featureCode);
    if (key === 'baseWorkloadDays') return String(getRrBaseWorkloadDays(d));
    if (key === 'integrationPointWorkload') return String(getIntegrationPointWorkloadDays(d));
    if (key === 'integrationPointSummary') return formatIntegrationPointWorkloads(d);
    if (key === 'days') return String(getDemandDisplayDays(d, demands));
    if (key === 'featureWorkload') return String(getIrWorkload(d));
    if (['finalDays', 'settlementDays'].includes(key)) return String(toNumber(d[key]));
    return String(d[key] ?? '');
  };
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
    if (key === 'acceptanceCriteria') return 52;
    const label = demandColumnLabels[key] || '';
    const values = list.map(d => cellText(d, key));
    const contentWidth = Math.max(textWidth(label), textWidth(columnFilters[key] || ''), ...values.map(textWidth));
    const controlPadding = ['source', 'budgetStatus', 'priority', 'status'].includes(key) ? 4 : 2;
    return Math.min(maxAutoColumnWidth, contentWidth + controlPadding);
  };
  const fitStyle = key => {
    if (demandView === 'IR') return key === 'title' ? { minWidth: '220px' } : undefined;
    return key === 'title' ? undefined : key === 'acceptanceCriteria' ? { width: '52ch', minWidth: '52ch', maxWidth: '52ch' } : { width: `${columnWidth(key)}ch`, minWidth: `${columnWidth(key)}ch` };
  };
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
  };
  const toggleDateSort = key => setDateSort(current => current.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' });
  const updateDemand = (id, key, value) => {
    if ((key === 'rr' || key === 'demandNo') && !isValidRrInput(value)) return;
    setDemands(ds => {
      if (key === 'demandNo' || key === 'rr') {
        const demandNo = formatRr(value);
        if (isValidRr(demandNo) && ds.some(d => d.id !== id && isRrDemand(d) && formatRr(d.demandNo || d.rr) === demandNo)) {
          alert(`RR需求单号不能重复：${demandNo}`);
          return ds;
        }
      }
      if (key === 'irNo' || key === 'ir') {
        const irNo = formatIr(value);
        if (isValidIr(irNo) && ds.some(d => d.id !== id && isIrDemand(d) && formatIr(d.irNo || d.ir) === irNo)) {
          alert(`IR单号不能重复：${irNo}`);
          return ds;
        }
      }
      return ds.map(d => d.id === id ? normalizeDemand({ ...d, [key]: value }) : d);
    });
  };
  const openEditDemand = demand => {
    const normalized = normalizeDemand(demand);
    setEditingDemandId(demand.id);
    setEditDraft(normalized);
    setEditError('');
  };
  const closeEditDemand = () => {
    setEditingDemandId(null);
    setEditDraft(null);
    setEditError('');
  };
  const setEditDraftField = (key, value) => {
    if ((key === 'rr' || key === 'demandNo') && !isValidRrInput(value)) return;
    if ((key === 'ir' || key === 'irNo') && !isValidIrInput(value)) return;
    setEditDraft(draft => {
      if (!draft) return draft;
      const next = { ...draft, [key]: value };
      if (key === 'landingDate' && value && !draft.poPeriod) next.poPeriod = String(value).slice(0, 7);
      if (key === 'investment') next.budgetPoolId = '';
      if (key === 'unifiedBudgetSource') applyUnifiedBudgetSource(next, value);
      if (key === 'budgetSourceType') {
        next.budgetSource = value === '其他' ? (draft.budgetSource || otherBudgetSourceOptions[0]) : '';
        next.budgetPoolId = '';
      }
      if (key === 'budgetSource') next.budgetPoolId = '';
      if (key === 'analysisStage') next.status = value;
      if (key === 'status' && analysisStageOptions.includes(value)) next.analysisStage = value;
      if (key === 'parentRrId') {
        const rr = demands.find(item => String(item.id) === String(value));
        next.parentRrNo = rr?.demandNo || rr?.rr || '';
      }
      if (key === 'featureId') {
        const feature = findFeature(features, value, '');
        next.featureCode = feature?.code || '';
      }
      if (key === 'featureWorkload') next.days = value;
      if (key === 'status' && value === '已上线' && !toNumber(next.settlementDays)) next.settlementDays = toNumber(next.days);
      if (key === 'status' && value === '已验收') {
        if (!toNumber(next.settlementDays)) next.settlementDays = toNumber(next.days);
        if (!toNumber(next.finalDays)) next.finalDays = toNumber(next.settlementDays);
      }
      return normalizeDemand(next);
    });
    setEditError('');
  };
  const saveEditDemand = () => {
    const normalized = normalizeDemand(editDraft || {});
    const error = validateDemand(normalized, demands, editingDemandId, features, integrationPoints);
    if (error) {
      setEditError(error);
      return;
    }
    if (editingDemandId) setDemands(ds => ds.map(d => d.id === editingDemandId ? { ...normalized, id: d.id } : d));
    else setDemands(ds => [...ds, { ...normalized, id: Date.now() }]);
    closeEditDemand();
  };
  const deleteDemand = id => {
    const target = demands.find(item => item.id === id);
    if (target && isRrDemand(target) && getRrChildren(demands, target).length) {
      alert('该RR下已有IR，不能直接删除。请先删除或转移IR。');
      return;
    }
    if (confirm(`确认删除该${isIrDemand(target) ? 'IR' : 'RR'}？`)) {
      setDemands(ds => ds.filter(x => x.id !== id));
      if (editingDemandId === id) closeEditDemand();
    }
  };
  const createIrFromRr = rr => {
    if (rr.analysisStage !== '已分析' && rr.status !== '已分析') {
      alert('请先将RR状态标记为“已分析”后再生成IR。');
      return;
    }
    const nextIr = normalizeDemand({ ...rr, id: undefined, demandKind: 'IR', demandNo: '', rr: rr.demandNo || rr.rr, parentRrId: rr.id, parentRrNo: rr.demandNo || rr.rr, irNo: '', ir: '', featureId: '', featureCode: '', featureWorkload: '', days: '', workloadAssignments: [], finalDays: 0, settlementDays: 0, integrationPointWorkloads: [], baseWorkloadDays: 0 });
    setEditingDemandId(null);
    setEditDraft(nextIr);
    setEditError('');
  };
  React.useEffect(() => {
    const handler = event => {
      const id = event.detail;
      setKeyword('');
      setFilter('全部');
      setColumnFilters({});
      setFilteredIds(null);
      setFilteredIdsLabel('');
      const demand = demands.find(item => item.id === id);
      if (demand) openEditDemand(demand);
      setTimeout(() => document.getElementById(`demand-row-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    };
    window.addEventListener('wfp.openDemand', handler);
    return () => window.removeEventListener('wfp.openDemand', handler);
  }, [demands]);
  React.useEffect(() => {
    const handler = event => {
      const { key, value } = event.detail || {};
      if (!key) return;
      setKeyword('');
      setFilter('全部');
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
      const parsed = parseDemandCsv(importDraft.text, importDraft.mapping).map((d, idx) => ({ ...d, id: Date.now() + idx }));
      const imported = resolveImportedDemandAssociations(parsed, demands, features).map(d => normalizeDemand(d));
      const duplicateInFile = getDuplicateDemandNos(imported);
      if (duplicateInFile.length) throw new Error(`导入文件内需求单号重复：${duplicateInFile.join('、')}`);
      const duplicateExisting = imported.map(d => isIrDemand(d) ? formatIr(d.irNo || d.ir) : formatRr(d.demandNo || d.rr)).filter(no => no && demands.some(existing => isIrDemand(d) ? (isIrDemand(existing) && formatIr(existing.irNo || existing.ir) === no) : (isRrDemand(existing) && formatRr(existing.demandNo || existing.rr) === no)));
      if (duplicateExisting.length) throw new Error(`单号已存在，不能重复导入：${[...new Set(duplicateExisting)].join('、')}`);
      setDemands(ds => [...ds, ...imported]);
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
  const columns = columnOrder.map(key => ({ key, label: demandColumnLabels[key] })).filter(column => column.label && visibleColumnKeys.includes(column.key));
  const toggleVisibleColumn = key => setVisibleColumnKeys(keys => keys.includes(key) ? keys.filter(item => item !== key) : [...keys, key]);
  const dashboardTotalDays = monthFiltered.reduce((sum, d) => sum + getDemandDisplayDays(d, demands), 0);
  const statusKpis = demandStatusOptions.map(status => {
    const rows = demands.filter(d => isRrDemand(d) && monthInRange(d) && d.status === status);
    const days = rows.reduce((sum, d) => sum + getDemandDisplayDays(d, demands), 0);
    return { status, count: rows.length, days };
  });
  const filterRrStatus = status => {
    setDemandView('RR');
    setKeyword('');
    setFilter('全部');
    setFilteredIds(null);
    setFilteredIdsLabel('');
    setColumnFilters({ status });
  };
  const demandPartyChoices = value => [...new Set([...demandPartyOptions, value].filter(Boolean))];
  const rrDemands = demands.filter(isRrDemand);
  const enabledFeatures = (features?.rows || []).filter(row => row.status !== '停用');
  const editBudgetPoolInfo = editDraft ? getDemandBudgetPoolInfo(editDraft, budget, demands, personnel, editingDemandId) : null;
  function displayDemandValue(d, key) {
    if (key === 'investment') return d.investment || '未填写需求方';
    if (key === 'budgetSource') return d.budgetSourceType === '其他' ? (d.budgetSource || '-') : '-';
    if (key === 'poPeriod') return formatPoPeriod(getDemandPoPeriod(d));
    if (key === 'demandKind') return getDemandKind(d);
    if (key === 'featureCode') return getFeatureLabel(features, d.featureId, d.featureCode);
    if (key === 'featureWorkload') return getIrWorkload(d);
    if (key === 'baseWorkloadDays') return getRrBaseWorkloadDays(d);
    if (key === 'integrationPointWorkload') return getIntegrationPointWorkloadDays(d);
    if (key === 'integrationPointSummary') return formatIntegrationPointWorkloads(d) || '-';
    if (key === 'days') return getDemandDisplayDays(d, demands);
    if (['finalDays', 'settlementDays'].includes(key)) return toNumber(d[key]);
    return d[key] || '-';
  }
  const renderDemandCell = (d, key) => {
    if (key === 'title') return <button className="title-link" onClick={()=>openEditDemand(d)}>{d.title || '未填写需求名称'}</button>;
    if (key === 'demandNo') {
      const demandNo = formatRr(d.demandNo);
      return <div className="stacked-control"><span>{demandNo || '-'}</span>{demandNo && !isValidRr(demandNo) && <small className="field-error">{rrFormatText}</small>}</div>;
    }
    if (key === 'irNo') {
      const irNo = formatIr(d.irNo || d.ir);
      return <div className="stacked-control"><span>{irNo || '-'}</span>{irNo && !isValidIr(irNo) && <small className="field-error">{irFormatText}</small>}</div>;
    }
    if (key === 'days' && isRrDemand(d)) {
      const children = getRrChildren(demands, d);
      return <div className="stacked-control"><span>{getDemandDisplayDays(d, demands)}</span>{children.length > 0 && <small className="muted">由 {children.length} 个IR汇总</small>}{getIntegrationPointWorkloadDays(d) > 0 && <small className="muted">含集成点 {getIntegrationPointWorkloadDays(d)} 人天</small>}</div>;
    }
    const value = displayDemandValue(d, key);
    const classes = ['acceptanceCriteria', 'pain', 'goal', 'value'].includes(key) ? 'readonly-text-cell' : '';
    return <span className={classes}>{value}</span>;
  };
  return <>
    <Header title="需求管理" desc="集中提交、查看、筛选、导入和维护需求清单。"/>
    <div className="lifecycle-flow-card"><div className="lifecycle-summary"><Kpi label="RR总数" value={`${demands.filter(isRrDemand).length} 个`}/><Kpi label="IR总数" value={`${demands.filter(isIrDemand).length} 个`}/></div><div className="lifecycle-flow">{statusKpis.map(item => <button key={item.status} className="lifecycle-step" onClick={()=>filterRrStatus(item.status)} title={`筛选${item.status}RR`}><span>{item.status}</span><b>{item.count} 个</b>{item.days > 0 && <small>{item.days} 人天</small>}</button>)}</div></div>
    <div className="toolbar demand-toolbar">
      <div className="actions"><select value={demandView} onChange={e=>setDemandView(e.target.value)}><option value="RR">RR视图</option><option value="IR">IR视图</option></select><input className="search-input" placeholder="全文检索：需求/单号/提出人/版本/RR/IR/状态" value={keyword} onChange={e=>setKeyword(e.target.value)}/><span className="month-filter-label">计划落地月份：</span><label className="month-filter-control"><span>开始月份</span><MonthSelect value={monthStart} onChange={setMonthStart} options={monthOptions}/></label><label className="month-filter-control"><span>结束月份</span><MonthSelect value={monthEnd} onChange={setMonthEnd} options={monthOptions}/></label></div>
    </div>
    <div className="toolbar demand-table-toolbar">
      <div className="actions"><button onClick={()=>setShowSubmitModal(true)}>提交需求</button></div>
      <div className="actions"><button onClick={clearAllFilters}>清除筛选</button><button onClick={()=>setShowColumnPicker(open=>!open)}>字段筛选</button><button onClick={()=>{ setColumnOrder(defaultColumnKeys); setVisibleColumnKeys(demandViewDefaultColumns.filter(key => !hiddenDemandColumnKeys.includes(key))); }}>恢复默认列顺序</button><label className="import-btn">导入<input type="file" accept=".csv,text/csv" onChange={onImport}/></label><button onClick={()=>downloadCsv(demands)}>导出</button></div>
    </div>
    {importMsg && <div className="notice">{importMsg}</div>}
    {filteredIds && <div className="notice">{filteredIdsLabel}：当前展示 {list.length} 条匹配需求 <button className="link neutral" onClick={clearAllFilters}>清除筛选</button></div>}
    {showColumnPicker && <section className="card column-picker"><div className="toolbar"><h2>字段筛选</h2><div className="actions"><button onClick={()=>setVisibleColumnKeys(defaultColumnKeys)}>全选</button><button onClick={()=>setVisibleColumnKeys(demandViewDefaultColumns.filter(key => !hiddenDemandColumnKeys.includes(key)))}>默认字段</button></div></div><p className="muted">勾选需要在需求清单呈现的字段；字段顺序可直接拖拽表头调整。</p><div className="column-picker-grid">{defaultColumnKeys.map(key => <label key={key} className="check"><input type="checkbox" checked={visibleColumnKeys.includes(key)} onChange={()=>toggleVisibleColumn(key)}/>{demandColumnLabels[key]}</label>)}</div></section>}
    {importDraft && <section className="card import-mapping-card"><h2>导入字段映射</h2><p className="muted">系统已推荐自动映射结果。带 * 的字段为必填字段，请检查不准确的字段，改为正确的CSV表头，或选择“不导入”。</p><div className="import-mapping-table"><table><thead><tr>{demandImportFields.map(([key, label]) => <th key={key} title={label}><span className={requiredDemandImportFields.has(key) ? 'required-label' : ''}>{label}</span></th>)}</tr><tr>{demandImportFields.map(([key, label]) => <th key={key}><select title={importDraft.mapping[key] || '不导入'} value={importDraft.mapping[key] || ''} onChange={e=>updateImportMapping(key, e.target.value)}><option value="">不导入</option>{importDraft.headers.map(header => <option key={header} value={header} title={header}>{header}</option>)}</select></th>)}</tr></thead><tbody>{importDraft.previewRows?.length ? importDraft.previewRows.map((row, idx) => <tr key={idx}>{demandImportFields.map(([key, label]) => { const value = importPreviewValue(row, key); return <td key={key} title={value}>{value}</td>; })}</tr>) : <tr><td colSpan={demandImportFields.length}>没有可预览的数据行</td></tr>}</tbody></table></div><div className="modal-actions"><button className="secondary" onClick={()=>setImportDraft(null)}>取消</button><button className="primary inline" onClick={confirmImport}>按映射导入</button></div></section>}
    <datalist id="demand-party-options">{demandPartyOptions.map(item => <option key={item} value={item}/>)}</datalist>
    {showSubmitModal && <DemandSubmit demands={demands} setDemands={setDemands} budget={budget} personnel={personnel} features={features} integrationPoints={integrationPoints} onClose={()=>setShowSubmitModal(false)} embedded/>}
    {editDraft && <div className="modal-backdrop" onClick={closeEditDemand}><div className="modal-card demand-edit-modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-header"><h2>需求详情</h2><button className="link neutral" onClick={closeEditDemand}>关闭</button></div>
      {editError && <div className="field-error">{editError}</div>}
      <div className="submit-layout">
        <section className="submit-section"><h2>{isIrDemand(editDraft) ? 'IR关联信息' : '分析信息'}</h2>{isIrDemand(editDraft) ? <div className="submit-grid four"><label><span className="required-label">IR单号</span><input className={editDraft.irNo && !isValidIr(editDraft.irNo) ? 'invalid' : ''} value={editDraft.irNo || ''} placeholder="IR2026053012345" onChange={e=>setEditDraftField('irNo',e.target.value)}/>{editDraft.irNo && !isValidIr(editDraft.irNo) && <small className="field-error">{irFormatText}</small>}</label><label><span className="required-label">关联RR</span><select value={editDraft.parentRrId || ''} onChange={e=>setEditDraftField('parentRrId', e.target.value)}><option value="">选择RR</option>{rrDemands.map(rr => <option key={rr.id} value={rr.id}>{rr.demandNo || rr.rr} / {rr.title || '未填写需求名称'}</option>)}</select></label><label><span className="required-label">关联特性</span><select value={editDraft.featureId || ''} onChange={e=>setEditDraftField('featureId', e.target.value)}><option value="">选择特性</option>{enabledFeatures.map(feature => <option key={feature.id} value={feature.id}>{getFeatureLabel(features, feature.id, feature.code)}</option>)}</select></label><label><span className="required-label">特性工作量</span><input type="number" value={editDraft.featureWorkload || ''} onChange={e=>setEditDraftField('featureWorkload', e.target.value)}/><small className="muted">同一RR下IR合计不能超过RR分配的总工作量</small></label></div> : <><div className="submit-grid two"><label><span className="required-label">分析阶段</span><select value={editDraft.analysisStage || '已提交'} onChange={e=>setEditDraftField('analysisStage', e.target.value)}>{analysisStageOptions.map(item => <option key={item}>{item}</option>)}</select></label><label>RR汇总工作量<input disabled value={getDemandDisplayDays(editDraft, demands)}/></label></div><label>分析结论<textarea value={editDraft.analysisConclusion || ''} onChange={e=>setEditDraftField('analysisConclusion', e.target.value)}/></label><div className="actions"><button className="secondary" onClick={()=>createIrFromRr(editDraft)} disabled={editDraft.analysisStage !== '已分析' && editDraft.status !== '已分析'}>生成IR</button><span className="muted">已分析后可多次生成IR；RR工作量由其下IR汇总。</span></div></>}</section>
        <section className="submit-section primary-info"><h2>基础信息</h2><div className="submit-grid five"><label><span className="required-label">需求名称</span><input value={editDraft.title || ''} onChange={e=>setEditDraftField('title',e.target.value)}/></label><label><span className={isScheduled(editDraft.status) ? 'required-label' : ''}>需求单号</span><input className={editDraft.demandNo && !isValidRr(editDraft.demandNo) ? 'invalid' : ''} value={editDraft.demandNo || ''} placeholder="RR2026053012345" onChange={e=>setEditDraftField('demandNo',e.target.value)}/>{editDraft.demandNo && !isValidRr(editDraft.demandNo) && <small className="field-error">{rrFormatText}</small>}</label><label><span className="required-label">提出人</span><input value={editDraft.requester || ''} onChange={e=>setEditDraftField('requester',e.target.value)}/></label><label>需求BA<input value={editDraft.demandBA || ''} onChange={e=>setEditDraftField('demandBA',e.target.value)}/></label><label>需求PM<input value={editDraft.demandPM || ''} onChange={e=>setEditDraftField('demandPM',e.target.value)}/></label><label><span className="required-label">需求方</span><select value={editDraft.investment || ''} onChange={e=>setEditDraftField('investment',e.target.value)}>{demandPartyChoices(editDraft.investment).map(item => <option key={item} value={item}>{item}</option>)}</select></label><label><span className="required-label">统一预算来源</span><select value={getUnifiedBudgetSourceValue(editDraft)} onChange={e=>setEditDraftField('unifiedBudgetSource',e.target.value)}>{['部门基线', ...otherBudgetSourceOptions].map(item => <option key={item} value={item}>{item}</option>)}</select></label><div className={`budget-pool-hint ${editBudgetPoolInfo?.overAmount > 0 || editBudgetPoolInfo?.missingPersonnelCost ? 'over' : ''}`}>{editBudgetPoolInfo?.pool ? <>扣减预算池：{editBudgetPoolInfo.pool.name}，来源：{editBudgetPoolInfo.pool.sourceName || '-'} / {editBudgetPoolInfo.pool.sourceOwner || '-'}，剩余额度 {toNumber(editBudgetPoolInfo.remaining).toFixed(1)}w，当前工作量成本 {toNumber(editBudgetPoolInfo.currentCost).toFixed(1)}w{editBudgetPoolInfo.missingPersonnelCost && <small className="field-error">当前需求尚未选择人员，无法计算预算池占用</small>}{editBudgetPoolInfo.overAmount > 0 && <small className="field-error">当前工作量成本超出预算池剩余额度 {toNumber(editBudgetPoolInfo.overAmount).toFixed(1)}w</small>}</> : '未匹配预算池，请在预算管理维护对应预算池'}</div></div></section>
        <section className="submit-section"><h2>分类与排期</h2><div className="submit-grid five"><label>类型<select className={editDraft.source === '临时紧急需求' ? 'danger-field' : ''} value={editDraft.source || '产品立项规划'} onChange={e=>setEditDraftField('source',e.target.value)}>{demandTypeOptions.map(item => <option key={item} value={item}>{item}</option>)}</select></label><label>优先级<select value={editDraft.priority || '一般'} onChange={e=>setEditDraftField('priority',e.target.value)}>{priorityOptions.map(priority => <option key={priority}>{priority}</option>)}</select></label><label>需求状态<select value={editDraft.status || '已提交'} onChange={e=>setEditDraftField('status',e.target.value)}>{demandStatusOptions.map(status => <option key={status}>{status}</option>)}</select></label><label>版本<input value={editDraft.version || ''} disabled={!isScheduled(editDraft.status)} placeholder={isScheduled(editDraft.status) ? '填写版本' : '排期后填写'} onChange={e=>setEditDraftField('version',e.target.value)}/></label><label>计划落地日期<input type="date" value={editDraft.landingDate || ''} onChange={e=>setEditDraftField('landingDate',e.target.value)}/></label><label>PO执行期间<input type="month" value={editDraft.poPeriod || getDemandPoPeriod(editDraft)} onChange={e=>setEditDraftField('poPeriod',e.target.value)}/></label></div></section>
        <div className="submit-stacked-sections"><section className="submit-section"><h2>工作量信息</h2><WorkloadFields value={editDraft} set={setEditDraftField} personnel={personnel} showSettlement integrationPoints={integrationPoints}/></section></div>
        <section className="submit-section"><h2>需求说明</h2><div className="submit-grid four textareas"><label>当前业务痛点<textarea value={editDraft.pain || ''} onChange={e=>setEditDraftField('pain',e.target.value)}/></label><label>需求目标<textarea value={editDraft.goal || ''} onChange={e=>setEditDraftField('goal',e.target.value)}/></label><label>需求价值<textarea value={editDraft.value || ''} onChange={e=>setEditDraftField('value',e.target.value)}/></label><label>验收标准<textarea value={editDraft.acceptanceCriteria || ''} onChange={e=>setEditDraftField('acceptanceCriteria',e.target.value)}/></label></div></section>
      </div>
      <div className="modal-actions"><button className="secondary" onClick={closeEditDemand}>取消</button><button className="primary inline" onClick={saveEditDemand}>保存</button></div>
    </div></div>}
    <div className="scroll-hint">表格可横向拖动查看全部字段，列宽可拖拽调整，表头可拖拽调整列顺序</div>
    <div className={`card table-card demand-table-card ${demandView === 'IR' ? 'ir-demand-table-card' : ''}`} ref={tableScrollRef}><table ref={tableRef}><thead><tr>{columns.map(column => <th key={column.key} style={fitStyle(column.key)} draggable className={`draggable-th ${column.key === 'acceptanceCriteria' ? 'acceptance-criteria-col' : ''} ${draggingColumn === column.key ? 'dragging-th' : ''} ${dropTarget?.key === column.key ? 'drop-target-th' : ''}`} onDragStart={e=>{ setDraggingColumn(column.key); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', column.key); }} onDragOver={e=>{ e.preventDefault(); const position = e.nativeEvent.offsetX > e.currentTarget.offsetWidth / 2 ? 'after' : 'before'; setDropTarget({ key: column.key, position }); }} onDrop={e=>{ e.preventDefault(); moveColumn(e.dataTransfer.getData('text/plain') || draggingColumn, column.key, dropTarget?.position || 'before'); setDraggingColumn(''); setDropTarget(null); }} onDragEnd={()=>{ setDraggingColumn(''); setDropTarget(null); }}><div className="th-filter"><span className={requiredDemandImportFields.has(column.key) ? 'required-label' : ''}><span className="column-drag-handle">↕</span>{column.label}<button className="sort-btn" draggable={false} onClick={e=>{ e.stopPropagation(); toggleDateSort(column.key); }}>{dateSort.key === column.key ? (dateSort.direction === 'asc' ? '↑' : '↓') : '↕'}</button></span><input style={fitStyle(column.key)} value={columnFilters[column.key] || ''} placeholder="筛选" onChange={e=>setColumnFilter(column.key, e.target.value)}/></div></th>)}<th>操作</th></tr></thead><tbody>{list.map(d =>
      <tr id={`demand-row-${d.id}`} key={d.id}>{columns.map(column => <td key={column.key} className={column.key === 'acceptanceCriteria' ? 'acceptance-criteria-col' : ''} style={fitStyle(column.key)}>{renderDemandCell(d, column.key)}</td>)}<td><button className="link neutral" onClick={()=>openEditDemand(d)}>详情</button><button className="link" onClick={()=>deleteDemand(d.id)}>删除</button></td></tr>
    )}</tbody></table></div>
  </>;
}

const RequiredLabel = ({ children }) => <span className="required-label">{children}</span>;

function WorkloadFields({ value, set, personnel = [], showSettlement = false, integrationPoints }) {
  const selectNumberOnFocus = event => event.currentTarget.select();
  const numberValue = next => next === '' || next === undefined || next === null ? '' : toNumber(next);
  const setNumber = (key, next) => {
    const normalized = next === '' ? '' : Number(next);
    set(key, normalized);
    if (isRrDemand(value) && ['analysis','frontend','middle','backend'].includes(key)) {
      const parts = { analysis: value.analysis, frontend: value.frontend, middle: value.middle, backend: value.backend, [key]: normalized };
      set('baseWorkloadDays', toNumber(parts.analysis) + toNumber(parts.frontend) + toNumber(parts.middle) + toNumber(parts.backend));
    }
  };
  const isBreakdown = value.workloadMode === 'breakdown';
  const canEditWorkload = value.status === '分析中' || isIrDemand(value);
  const canEditIntegrationWorkload = isRrDemand(value) && !['已上线', '已验收'].includes(value.status);
  const canEditSettlement = ['已上线', '已验收'].includes(value.status);
  const canEditFinal = value.status === '已验收';
  const personnelById = getPersonnelByIdMap(personnel);
  const assignments = Array.isArray(value.workloadAssignments) ? value.workloadAssignments : [];
  const syncAssignmentTotals = nextAssignments => {
    const totals = { analysis: 0, frontend: 0, middle: 0, backend: 0 };
    nextAssignments.forEach(item => { if (totals[item.role] !== undefined) totals[item.role] += toNumber(item.days); });
    set('workloadAssignments', nextAssignments);
    set(isRrDemand(value) ? 'baseWorkloadDays' : 'days', nextAssignments.reduce((sum, item) => sum + toNumber(item.days), 0));
    Object.entries(totals).forEach(([key, days]) => set(key, days));
  };
  const updateAssignment = (id, key, nextValue) => syncAssignmentTotals(assignments.map(item => item.id === id ? { ...item, [key]: key === 'days' ? (nextValue === '' ? '' : Number(nextValue)) : nextValue } : item));
  const addAssignment = () => syncAssignmentTotals([...assignments, { id: `assign-${Date.now()}`, personnelId: personnel[0]?.id || '', role: 'backend', days: 1, note: '' }]);
  const deleteAssignment = id => syncAssignmentTotals(assignments.filter(item => item.id !== id));
  const totalCost = getDemandWorkloadCostWan(value, personnel);
  const ipRows = normalizeIntegrationPointWorkloads(value.integrationPointWorkloads || [], value.id || value.demandNo || 'draft');
  const enabledIps = integrationPoints?.rows || [];
  const syncIpRows = rows => set('integrationPointWorkloads', rows);
  const addIpRow = () => syncIpRows([...ipRows, { id: `ipw-${Date.now()}`, integrationPointId: '', product: '', subProduct: '', itService: '', module: '', interfaceContent: '', allocatedWorkload: 1 }]);
  const updateIpRow = (id, key, nextValue) => syncIpRows(ipRows.map(row => {
    if (row.id !== id) return row;
    const next = { ...row, [key]: key === 'allocatedWorkload' ? (nextValue === '' ? '' : Number(nextValue)) : nextValue };
    if (key === 'integrationPointId') {
      const catalogRow = findIntegrationPoint(integrationPoints, nextValue, '', '', '');
      next.product = catalogRow?.product || '';
      next.subProduct = catalogRow?.subProduct || '';
      next.itService = catalogRow?.itService || '';
      next.module = catalogRow?.module || '';
    }
    return next;
  }));
  const deleteIpRow = id => syncIpRows(ipRows.filter(row => row.id !== id));
  const baseDays = getRrBaseWorkloadDays(value);
  const ipDays = getIntegrationPointWorkloadDays(value);
  return <div className="workload-fields">
    <div className="submit-grid two workload-row"><label><RequiredLabel>填写方式</RequiredLabel><select value={value.workloadMode || 'total'} disabled={!canEditWorkload} onChange={e=>set('workloadMode',e.target.value)}><option value="total">按总量</option><option value="breakdown">按分项</option></select></label><label><RequiredLabel>{isRrDemand(value) ? '基础人天' : '总人天'}</RequiredLabel><input type="number" onFocus={selectNumberOnFocus} value={numberValue(isRrDemand(value) ? value.baseWorkloadDays : value.days)} disabled={isBreakdown || !canEditWorkload} placeholder={!canEditWorkload ? '仅分析中可填写' : (isBreakdown ? '按分项自动汇总' : '填写总人天')} onChange={e=>setNumber(isRrDemand(value) ? 'baseWorkloadDays' : 'days',e.target.value)}/></label></div>
    <div className="submit-grid four workload-row"><label>分析<input type="number" onFocus={selectNumberOnFocus} value={numberValue(value.analysis)} disabled={!isBreakdown || !canEditWorkload} onChange={e=>setNumber('analysis',e.target.value)}/></label><label>前端<input type="number" onFocus={selectNumberOnFocus} value={numberValue(value.frontend)} disabled={!isBreakdown || !canEditWorkload} onChange={e=>setNumber('frontend',e.target.value)}/></label><label>中台<input type="number" onFocus={selectNumberOnFocus} value={numberValue(value.middle)} disabled={!isBreakdown || !canEditWorkload} onChange={e=>setNumber('middle',e.target.value)}/></label><label>后台<input type="number" onFocus={selectNumberOnFocus} value={numberValue(value.backend)} disabled={!isBreakdown || !canEditWorkload} onChange={e=>setNumber('backend',e.target.value)}/></label></div>
    <div className="submit-grid two workload-row workload-final-row">{showSettlement && <label>结算人力<input type="number" onFocus={selectNumberOnFocus} value={numberValue(value.settlementDays)} disabled={!canEditSettlement} placeholder={canEditSettlement ? '默认与预估人力一致，可手动修改' : '上线后填写'} onChange={e=>setNumber('settlementDays',e.target.value)}/></label>}<label>决算人力<input type="number" onFocus={selectNumberOnFocus} value={numberValue(value.finalDays)} disabled={!canEditFinal} placeholder={canEditFinal ? '默认与结算人力一致，可手动修改' : '验收后填写'} onChange={e=>setNumber('finalDays',e.target.value)}/></label></div>
    {isRrDemand(value) && <><div className="mini-table workload-assignment-table integration-workload-table"><table><thead><tr><th>集成点</th><th>集成诉求</th><th>分摊工作量</th><th>操作</th></tr></thead><tbody>{ipRows.length ? ipRows.map(row => <tr key={row.id}><td><select value={row.integrationPointId || ''} disabled={!canEditIntegrationWorkload} onChange={e=>updateIpRow(row.id, 'integrationPointId', e.target.value)}><option value="">选择集成点</option>{enabledIps.map(item => <option key={item.id} value={item.id}>{getIntegrationPointLabel(item)}</option>)}</select>{!row.integrationPointId && (row.product || row.subProduct) && <small className="muted">{getIntegrationPointLabel(row)}</small>}</td><td><textarea value={row.interfaceContent || ''} disabled={!canEditIntegrationWorkload} onChange={e=>updateIpRow(row.id, 'interfaceContent', e.target.value)} placeholder="填写集成诉求"/></td><td><input type="number" onFocus={selectNumberOnFocus} value={numberValue(row.allocatedWorkload)} disabled={!canEditIntegrationWorkload} onChange={e=>updateIpRow(row.id, 'allocatedWorkload', e.target.value)}/></td><td><button className="link" disabled={!canEditIntegrationWorkload} onClick={()=>deleteIpRow(row.id)}>删除</button></td></tr>) : <tr><td colSpan="4">尚未添加集成点工作量</td></tr>}</tbody></table></div><div className="actions"><button className="secondary" onClick={addIpRow} disabled={!canEditIntegrationWorkload}>添加集成点工作量</button><span className="muted">基础工作量 {baseDays} 人天；集成点工作量 {ipDays} 人天；RR总工作量 {getRrOwnTotalWorkloadDays(value)} 人天。预算占用仍以人员工作量明细计算。</span></div></>}
    <div className="mini-table workload-assignment-table"><table><thead><tr><th>人员</th><th>工作类型</th><th>人天</th><th>日单价</th><th>小计</th><th>备注</th><th>操作</th></tr></thead><tbody>{assignments.length ? assignments.map(item => { const person = personnelById.get(String(item.personnelId)); return <tr key={item.id}><td><select value={item.personnelId || ''} disabled={!canEditWorkload} onChange={e=>updateAssignment(item.id, 'personnelId', e.target.value)}><option value="">选择人员</option>{personnel.map(p => <option key={p.id} value={p.id}>{p.owner || '未分组'} / {p.name} / {p.employeeNo || p.position}</option>)}</select></td><td><select value={item.role || 'other'} disabled={!canEditWorkload} onChange={e=>updateAssignment(item.id, 'role', e.target.value)}>{workloadRoleOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></td><td><input type="number" onFocus={selectNumberOnFocus} value={numberValue(item.days)} disabled={!canEditWorkload} onChange={e=>updateAssignment(item.id, 'days', e.target.value)}/></td><td>{toNumber(person?.dailyCost).toFixed(0)} 元/人天</td><td>{getWorkloadAssignmentCostWan(item, personnelById).toFixed(1)}w</td><td><input value={item.note || ''} disabled={!canEditWorkload} onChange={e=>updateAssignment(item.id, 'note', e.target.value)}/></td><td><button className="link" disabled={!canEditWorkload} onClick={()=>deleteAssignment(item.id)}>删除</button></td></tr>; }) : <tr><td colSpan="7">{personnel.length ? '尚未添加人员工作量，预算池占用不会计算' : '暂无人员数据，请先到人员管理维护人员和日单价'}</td></tr>}</tbody></table></div>
    <div className="actions"><button className="secondary" onClick={addAssignment} disabled={!personnel.length || !canEditWorkload}>添加人员工作量</button><span className="muted">工作量成本合计：{totalCost.toFixed(1)} 万元</span></div>
  </div>;
}

function DemandSubmit({demands, setDemands, budget, personnel = [], features, integrationPoints, goPool, onClose, embedded = false}) {
  const [form, setForm] = useState(createEmptyDemand);
  const set = (k,v)=>{
    if ((k === 'rr' || k === 'demandNo') && !isValidRrInput(v)) return;
    if ((k === 'ir' || k === 'irNo') && !isValidIrInput(v)) return;
    setForm(f=>{
      const next = { ...f, [k]: v };
      if (k === 'landingDate' && v && !f.poPeriod) next.poPeriod = String(v).slice(0, 7);
      if (k === 'investment') next.budgetPoolId = '';
      if (k === 'unifiedBudgetSource') applyUnifiedBudgetSource(next, v);
      if (k === 'budgetSourceType') {
        next.budgetSource = v === '其他' ? (f.budgetSource || otherBudgetSourceOptions[0]) : '';
        next.budgetPoolId = '';
      }
      if (k === 'budgetSource') next.budgetPoolId = '';
      if (k === 'analysisStage') next.status = v;
      if (k === 'status' && analysisStageOptions.includes(v)) next.analysisStage = v;
      if (k === 'featureWorkload') next.days = v;
      if (k === 'status' && v === '已上线' && !toNumber(next.settlementDays)) next.settlementDays = toNumber(next.days);
      if (k === 'status' && v === '已验收') {
        if (!toNumber(next.settlementDays)) next.settlementDays = toNumber(next.days);
        if (!toNumber(next.finalDays)) next.finalDays = toNumber(next.settlementDays);
      }
      return normalizeDemand(next);
    });
  };
  const budgetPoolInfo = getDemandBudgetPoolInfo(form, budget, demands, personnel);
  const submit = () => {
    const error = validateDemand(form, demands, null, features, integrationPoints);
    if (error) {
      alert(error);
      return;
    }
    setDemands(ds=>[...ds,{...normalizeDemand(form),id:Date.now()}]);
    onClose?.();
    goPool?.();
  };
  const content = <div className="submit-layout card submit-card">
    <section className="submit-section primary-info"><h2>基础信息</h2><div className="submit-grid five"><label><RequiredLabel>需求名称</RequiredLabel><input value={form.title} onChange={e=>set('title',e.target.value)}/></label><label>需求单号<input className={form.demandNo && !isValidRr(form.demandNo) ? 'invalid' : ''} value={form.demandNo} placeholder="RR2026053012345" onChange={e=>set('demandNo',e.target.value)}/>{form.demandNo && !isValidRr(form.demandNo) && <small className="field-error">{rrFormatText}</small>}</label><label><RequiredLabel>提出人</RequiredLabel><input value={form.requester} onChange={e=>set('requester',e.target.value)}/></label><label>需求BA<input value={form.demandBA || ''} onChange={e=>set('demandBA',e.target.value)}/></label><label>需求PM<input value={form.demandPM || ''} onChange={e=>set('demandPM',e.target.value)}/></label><label><RequiredLabel>需求方</RequiredLabel><select value={form.investment} onChange={e=>set('investment',e.target.value)}>{demandPartyOptions.map(item => <option key={item} value={item}>{item}</option>)}</select></label><label><RequiredLabel>统一预算来源</RequiredLabel><select value={getUnifiedBudgetSourceValue(form)} onChange={e=>set('unifiedBudgetSource',e.target.value)}>{['部门基线', ...otherBudgetSourceOptions].map(item => <option key={item} value={item}>{item}</option>)}</select></label><div className={`budget-pool-hint ${budgetPoolInfo.overAmount > 0 || budgetPoolInfo.missingPersonnelCost ? 'over' : ''}`}>{budgetPoolInfo.pool ? <>扣减预算池：{budgetPoolInfo.pool.name}，来源：{budgetPoolInfo.pool.sourceName || '-'} / {budgetPoolInfo.pool.sourceOwner || '-'}，剩余额度 {toNumber(budgetPoolInfo.remaining).toFixed(1)}w，当前工作量成本 {toNumber(budgetPoolInfo.currentCost).toFixed(1)}w{budgetPoolInfo.missingPersonnelCost && <small className="field-error">当前需求尚未选择人员，无法计算预算池占用</small>}{budgetPoolInfo.overAmount > 0 && <small className="field-error">当前工作量成本超出预算池剩余额度 {toNumber(budgetPoolInfo.overAmount).toFixed(1)}w</small>}</> : '未匹配预算池，请在预算管理维护对应预算池'}</div></div></section>
    <section className="submit-section"><h2>分类与排期</h2><div className="submit-grid five"><label><RequiredLabel>类型</RequiredLabel><select className={form.source === '临时紧急需求' ? 'danger-field' : ''} value={form.source} onChange={e=>set('source',e.target.value)}>{demandTypeOptions.map(item => <option key={item} value={item}>{item}</option>)}</select></label><label><RequiredLabel>优先级</RequiredLabel><select value={form.priority} onChange={e=>set('priority',e.target.value)}>{priorityOptions.map(priority => <option key={priority}>{priority}</option>) }</select></label><label>版本<input value={form.version} disabled={!isScheduled(form.status)} placeholder={isScheduled(form.status) ? '填写版本' : '排期后填写'} onChange={e=>set('version',e.target.value)}/></label><label><RequiredLabel>计划落地日期</RequiredLabel><input type="date" value={form.landingDate} onChange={e=>set('landingDate',e.target.value)}/></label><label><RequiredLabel>PO执行期间</RequiredLabel><input type="month" value={form.poPeriod || getDemandPoPeriod(form)} onChange={e=>set('poPeriod',e.target.value)}/></label></div></section>
    <div className="submit-stacked-sections"><section className="submit-section"><h2>工作量信息</h2><WorkloadFields value={form} set={set} personnel={personnel} integrationPoints={integrationPoints}/></section></div>
    <section className="submit-section"><h2>需求说明</h2><div className="submit-grid four textareas"><label>当前业务痛点<textarea value={form.pain} onChange={e=>set('pain',e.target.value)}/></label><label>需求目标<textarea value={form.goal} onChange={e=>set('goal',e.target.value)}/></label><label>需求价值<textarea value={form.value} onChange={e=>set('value',e.target.value)}/></label><label>验收标准<textarea value={form.acceptanceCriteria || ''} onChange={e=>set('acceptanceCriteria',e.target.value)}/></label></div></section>
    <div className="submit-actions">{embedded && <button className="secondary" onClick={onClose}>取消</button>}<button className="primary" onClick={submit}>提交需求</button></div>
  </div>;
  if (embedded) return <div className="modal-backdrop" onClick={onClose}><div className="modal-card demand-submit-modal" onClick={e=>e.stopPropagation()}><div className="modal-header"><h2>提交需求</h2><button className="link neutral" onClick={onClose}>关闭</button></div>{content}</div></div>;
  return <><Header title="提交需求" desc="按结构化表单一次性登记需求核心信息。"/>{content}</>;
}

const personnelImportFields = [
  ['name', '人员姓名', ['人员姓名', '姓名', '人员']], ['employeeNo', '工号', ['工号', '员工号', '人员编号']], ['owner', '团队/负责人', ['团队/负责人', '团队', '负责人', '归属负责人', '团队负责人']], ['position', '岗位', ['岗位', '职位', '角色']], ['personnelType', '人员类型', ['人员类型', '人员类别', '类型', 'OD/TM', 'OD', 'TM', '人员属性']], ['location', '地点', ['地点', '办公地点', '城市', '所在地']], ['supplier', '供应商', ['供应商', '厂商', '外包供应商', '合作方']], ['entryDate', '入项时间', ['入项时间', '入场时间', '入项日期']], ['dailyCost', '人天成本（元/人天）', ['人天成本（元/人天）', '人天成本', '元/人天']], ['monthlyDays', '月度可用人天', ['月度可用人天', '月可用人天']]
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
    personnelType: normalizePersonnelType(get(record, 'personnelType')),
    location: get(record, 'location'),
    supplier: normalizeSupplier(get(record, 'supplier')),
    entryDate: get(record, 'entryDate'),
    dailyCost: toNumber(get(record, 'dailyCost')),
    monthlyDays: toNumber(get(record, 'monthlyDays', '22.5')) || 22.5
  })).filter(p => p.name || p.employeeNo);
}
function downloadPersonnelCsv(personnel) {
  const headers = personnelImportFields.map(([, label]) => label);
  const lines = [headers.join(',')].concat(personnel.map(p => [p.name,p.employeeNo,p.owner,p.position,p.personnelType,p.location,p.supplier,p.entryDate,p.dailyCost,p.monthlyDays].map(v=>`"${String(v ?? '').replaceAll('"','""')}"`).join(',')));
  const blob = new Blob(['\ufeff' + lines.join('\n')], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'personnel.csv'; a.click();
}
function downloadPersonnelImportTemplate() {
  const headers = personnelImportFields.map(([, label]) => label);
  const sample = ['张三','TM-001','交付一组','后端','TM','深圳','赛意','2026-01-01','1481.48','22.5'];
  const blob = new Blob(['\ufeff' + [headers.join(','), sample.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')].join('\n')], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'personnel-import-template.csv'; a.click();
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

function isDemandActualOccupied(d) {
  return ['已上线', '已验收'].includes(d.status);
}

function buildPersonnelTrendRows(personnel, demands, monthStart, monthEnd) {
  const months = [];
  let cursor = monthStart;
  while (cursor <= monthEnd && months.length < 36) { months.push(cursor); cursor = addMonths(cursor, 1); }
  return months.map(month => {
    const active = personnel.filter(p => !p.entryDate || String(p.entryDate).slice(0, 7) <= month);
    const headcount = active.length;
    const availableDays = active.reduce((s, p) => s + toNumber(p.monthlyDays || 22.5), 0);
    const monthDemands = demands.filter(d => getDemandMonth(d) === month);
    const occupiedDays = monthDemands.filter(isDemandActualOccupied).reduce((s, d) => s + getExecutionDays(d), 0);
    const preOccupiedDays = monthDemands.filter(d => !isDemandActualOccupied(d)).reduce((s, d) => s + toNumber(d.days), 0);
    const totalOccupiedDays = occupiedDays + preOccupiedDays;
    return { month, headcount, availableDays, occupiedDays, preOccupiedDays, totalOccupiedDays, occupancyRate: availableDays > 0 ? totalOccupiedDays / availableDays : 0, demandCount: monthDemands.length };
  });
}

function buildPersonnelTrendOption(rows) {
  const legendRules = {
    可用人天: '可用人天 = 当月已入项人员的月度可用人天合计。',
    已占用人天: '已占用人天 = 计划落地在当月，且状态为已上线/已验收需求的执行人天合计；执行人天优先取决算人力，其次结算人力，最后预估人天。',
    预占用人天: '预占用人天 = 计划落地在当月，且尚未上线/验收需求的预估人天合计。',
    总占用率: '总占用率 =（已占用人天 + 预占用人天）÷ 可用人天 × 100%。'
  };
  return {
    color: ['#16a34a', '#2563eb', '#f97316', '#7c3aed'],
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: params => params.map(p => `${p.seriesName}: ${p.seriesName.includes('占用率') ? p.value + '%' : p.value + '人天'}`).join('<br/>') },
    legend: { top: 0, tooltip: { show: true, confine: true, appendToBody: false, position: (point, params, dom, rect, size) => [Math.min(point[0] + 8, size.viewSize[0] - size.contentSize[0] - 8), Math.min(point[1] + 8, size.viewSize[1] - size.contentSize[1] - 8)], formatter: params => legendRules[params?.name] || params?.name || '' } },
    grid: { left: 56, right: 58, top: 42, bottom: 38 },
    xAxis: { type: 'category', data: rows.map(r => r.month) },
    yAxis: [{ type: 'value', name: '人天' }, { type: 'value', name: '占用率', axisLabel: { formatter: '{value}%' } }],
    series: [
      { name: '可用人天', type: 'bar', data: rows.map(r => Number(r.availableDays.toFixed(1))) },
      { name: '已占用人天', type: 'bar', stack: 'occupied', data: rows.map(r => Number(r.occupiedDays.toFixed(1))) },
      { name: '预占用人天', type: 'bar', stack: 'occupied', data: rows.map(r => Number(r.preOccupiedDays.toFixed(1))) },
      { name: '总占用率', type: 'line', smooth: true, yAxisIndex: 1, data: rows.map(r => Number((r.occupancyRate * 100).toFixed(1))) }
    ]
  };
}


function getPersonnelByIdMap(personnel = []) {
  return new Map((Array.isArray(personnel) ? personnel : []).map(p => [String(p.id), p]));
}

function getWorkloadAssignmentCostWan(assignment, personnelById) {
  const person = personnelById.get(String(assignment?.personnelId));
  return toNumber(assignment?.days) * toNumber(person?.dailyCost) / 10000;
}

function getDemandWorkloadDaysFromAssignments(demand) {
  return (Array.isArray(demand?.workloadAssignments) ? demand.workloadAssignments : []).reduce((sum, item) => sum + toNumber(item.days), 0);
}

function getDemandWorkloadCostWan(demand, personnel = []) {
  const personnelById = getPersonnelByIdMap(personnel);
  return (Array.isArray(demand?.workloadAssignments) ? demand.workloadAssignments : []).reduce((sum, item) => sum + getWorkloadAssignmentCostWan(item, personnelById), 0);
}

function buildPersonnelDemandLinks(personnel, demands, poPeriod) {
  const personnelById = getPersonnelByIdMap(personnel);
  return demands.filter(d => getDemandPoPeriod(d) === poPeriod).flatMap(d => {
    const assignments = Array.isArray(d.workloadAssignments) ? d.workloadAssignments : [];
    return assignments.filter(item => item.personnelId && toNumber(item.days) > 0).map(item => {
      const person = personnelById.get(String(item.personnelId));
      const team = person?.owner || '未分组';
      const days = toNumber(item.days);
      const cost = days * toNumber(person?.dailyCost) / 10000;
      return { id: `${d.id}-${item.id}`, demand: d, demandId: d.demandNo || d.rr || d.id, demandKey: d.id, title: d.title || '未填写需求名称', status: d.status || '待评估', priority: d.priority || '一般', landingDate: d.landingDate || '', personnelId: item.personnelId, personName: person?.name || '未知人员', employeeNo: person?.employeeNo || '', position: person?.position || '', team, role: workloadRoleLabels[item.role] || '其他', days, cost, note: item.note || '' };
    });
  });
}

function buildTeamPersonnelDemandTree(personnel, demands, poPeriod) {
  const links = buildPersonnelDemandLinks(personnel, demands, poPeriod);
  const teams = new Map();
  links.forEach(link => {
    const team = teams.get(link.team) || { team: link.team, people: new Map(), linkedDemandIds: new Set(), days: 0, cost: 0 };
    const personKey = String(link.personnelId || link.personName);
    const person = team.people.get(personKey) || { personnelId: link.personnelId, personName: link.personName, employeeNo: link.employeeNo, position: link.position, assignments: [], linkedDemandIds: new Set(), days: 0, cost: 0 };
    person.assignments.push(link);
    person.linkedDemandIds.add(link.demandKey);
    person.days += link.days;
    person.cost += link.cost;
    team.people.set(personKey, person);
    team.linkedDemandIds.add(link.demandKey);
    team.days += link.days;
    team.cost += link.cost;
    teams.set(link.team, team);
  });
  return [...teams.values()].map(team => ({ ...team, people: [...team.people.values()].map(person => ({ ...person, demandCount: person.linkedDemandIds.size })).sort((a, b) => b.days - a.days), peopleCount: team.people.size, demandCount: team.linkedDemandIds.size })).sort((a, b) => b.days - a.days);
}

function buildDemandPersonnelRows(personnel, demands, poPeriod) {
  const links = buildPersonnelDemandLinks(personnel, demands, poPeriod);
  const linksByDemand = new Map();
  links.forEach(link => linksByDemand.set(link.demandKey, [...(linksByDemand.get(link.demandKey) || []), link]));
  return demands.filter(d => getDemandPoPeriod(d) === poPeriod).map(d => {
    const items = linksByDemand.get(d.id) || [];
    const teams = [...new Set(items.map(item => item.team))];
    return { demand: d, demandKey: d.id, demandId: d.demandNo || d.rr || d.id, title: d.title || '未填写需求名称', status: d.status || '待评估', priority: d.priority || '一般', landingDate: d.landingDate || '', peopleCount: new Set(items.map(item => item.personnelId)).size, teams, days: items.reduce((s, item) => s + item.days, 0), cost: items.reduce((s, item) => s + item.cost, 0), assignments: items };
  }).sort((a, b) => String(a.landingDate).localeCompare(String(b.landingDate)) || String(a.demandId).localeCompare(String(b.demandId)));
}

function hasWorkloadAssignmentCost(demand, personnel = []) {
  const personnelById = getPersonnelByIdMap(personnel);
  return (Array.isArray(demand?.workloadAssignments) ? demand.workloadAssignments : []).some(item => item.personnelId && toNumber(item.days) > 0 && toNumber(personnelById.get(String(item.personnelId))?.dailyCost) > 0);
}

function formatWorkloadAssignments(demand, personnel = []) {
  const personnelById = getPersonnelByIdMap(personnel);
  const items = Array.isArray(demand?.workloadAssignments) ? demand.workloadAssignments : [];
  if (!items.length) return '未选择人员，预算占用未计算';
  return items.map(item => {
    const person = personnelById.get(String(item.personnelId));
    const cost = getWorkloadAssignmentCostWan(item, personnelById);
    return `${person?.name || '未知人员'} / ${workloadRoleLabels[item.role] || '其他'} / ${toNumber(item.days).toFixed(1)}人天 / ${cost.toFixed(1)}w`;
  }).join('；');
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
    const availableCost = active.reduce((s, p) => s + toNumber(p.dailyCost) * toNumber(p.monthlyDays || 22.5) / 10000, 0);
    const monthDemands = demandCostRows.filter(row => row.month === month);
    const occupiedCost = monthDemands.filter(isDemandActualOccupied).reduce((s, row) => s + row.executionCost, 0);
    const preOccupiedCost = monthDemands.filter(row => !isDemandActualOccupied(row)).reduce((s, row) => s + row.estimatedCost, 0);
    const totalOccupiedCost = occupiedCost + preOccupiedCost;
    return { month, availableCost, occupiedCost, preOccupiedCost, totalOccupiedCost, costOccupancyRate: availableCost > 0 ? totalOccupiedCost / availableCost : 0, demandCount: monthDemands.length };
  });
}

function buildPersonnelCostTrendOption(rows) {
  const legendRules = {
    可用人力费用: '可用人力费用 = 当月已入项人员的（日单价 × 月度可用人天）合计 ÷ 10000。',
    已占用费用: '已占用费用 = 计划落地在当月，且状态为已上线/已验收需求的执行费用合计；执行费用 = 执行人天 × 平均人天成本。',
    预占用费用: '预占用费用 = 计划落地在当月，且尚未上线/验收需求的预估费用合计；预估费用 = 预估人天 × 平均人天成本。',
    费用占用率: '费用占用率 =（已占用费用 + 预占用费用）÷ 可用人力费用 × 100%。'
  };
  return {
    color: ['#16a34a', '#2563eb', '#f97316', '#7c3aed'],
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: params => params.map(p => `${p.seriesName}: ${p.seriesName.includes('占用率') ? p.value + '%' : p.value + 'w'}`).join('<br/>') },
    legend: { top: 0, tooltip: { show: true, confine: true, appendToBody: false, position: (point, params, dom, rect, size) => [Math.min(point[0] + 8, size.viewSize[0] - size.contentSize[0] - 8), Math.min(point[1] + 8, size.viewSize[1] - size.contentSize[1] - 8)], formatter: params => legendRules[params?.name] || params?.name || '' } },
    grid: { left: 56, right: 58, top: 42, bottom: 38 },
    xAxis: { type: 'category', data: rows.map(r => r.month) },
    yAxis: [{ type: 'value', name: 'w' }, { type: 'value', name: '占用率', axisLabel: { formatter: '{value}%' } }],
    series: [
      { name: '可用人力费用', type: 'bar', data: rows.map(r => Number(r.availableCost.toFixed(1))) },
      { name: '已占用费用', type: 'bar', stack: 'occupiedCost', data: rows.map(r => Number(r.occupiedCost.toFixed(1))) },
      { name: '预占用费用', type: 'bar', stack: 'occupiedCost', data: rows.map(r => Number(r.preOccupiedCost.toFixed(1))) },
      { name: '费用占用率', type: 'line', smooth: true, yAxisIndex: 1, data: rows.map(r => Number((r.costOccupancyRate * 100).toFixed(1))) }
    ]
  };
}

function Personnel({personnel, setPersonnel, demands = [], budget, openDemand, openDemandIds, initialPoPeriod = ''}) {
  const [importMsg, setImportMsg] = useState('');
  const [importDraft, setImportDraft] = useState(null);
  const [addDraft, setAddDraft] = useState(null);
  const [personnelSort, setPersonnelSort] = useState({ key: '', direction: 'asc' });
  const [activeTab, setActiveTab] = useState('base');
  const [poPeriod, setPoPeriod] = useState(() => initialPoPeriod || getCurrentMonthKey());
  const [expandedTeams, setExpandedTeams] = useState(() => new Set());
  const [expandedPeople, setExpandedPeople] = useState(() => new Set());
  const [expandedDemands, setExpandedDemands] = useState(() => new Set());
  const defaultTrendStart = `${new Date().getFullYear()}-01`;
  const [monthStart, setMonthStart] = useState(defaultTrendStart);
  const [monthEnd, setMonthEnd] = useState(addMonths(defaultTrendStart, 11));
  const normalized = personnel.map(normalizePersonnel);
  const update=(id,k,v)=>{ if (k === 'employeeNo') { const employeeNo = String(v).trim(); if (employeeNo && normalized.some(p => p.id !== id && String(p.employeeNo).trim() === employeeNo)) { alert(`工号已存在：${employeeNo}`); return; } } setPersonnel(ps=>normalized.map(p=>p.id===id?normalizePersonnel({...p,[k]:v}):p)); };
  const openAddPersonnel = () => setAddDraft({ name: '', employeeNo: '', owner: '', position: '后端', personnelType: 'TM', location: '', supplier: '赛意', entryDate: '', dailyCost: 1481.48, monthlyDays: 22.5 });
  const confirmAddPersonnel=()=>{ const name = addDraft.name.trim(); const employeeNo = addDraft.employeeNo.trim(); if (!name) { alert('新增人员失败：请填写人员姓名'); return; } if (!employeeNo) { alert('新增人员失败：请填写工号'); return; } if (normalized.some(p => String(p.employeeNo).trim() === employeeNo)) { alert(`新增人员失败：工号已存在：${employeeNo}`); return; } setPersonnel(ps=>[...normalized,normalizePersonnel({id:Date.now(),...addDraft,name,employeeNo})]); setAddDraft(null); };
  const deletePersonnel=id=>setPersonnel(ps=>normalized.filter(p=>p.id!==id));
  const updateImportMapping = (key, header) => setImportDraft(draft => ({ ...draft, mapping: { ...draft.mapping, [key]: header } }));
  const importPreviewValue = (row, key) => { const idx = importDraft?.headers?.indexOf(importDraft?.mapping?.[key]); return idx >= 0 ? (row[idx] || '') : ''; };
  const onImport = async event => { const file = event.target.files?.[0]; if (!file) return; try { const text = await file.text(); const rows = parseCsv(text); if (rows.length < 2) throw new Error('CSV至少需要表头和一行数据'); const headers = rows[0].map(h => h.trim()).filter(Boolean); const previewRows = rows.slice(1).filter(row => row.some(cell => String(cell ?? '').trim() !== '')).slice(0, 5); setImportDraft({ text, headers, mapping: guessPersonnelImportMapping(headers), previewRows }); setImportMsg('已读取文件，请确认字段映射后导入'); } catch (err) { setImportMsg(`导入失败：${err.message}`); } finally { event.target.value = ''; } };
  const confirmImport = () => { try { const imported = parsePersonnelCsv(importDraft.text, importDraft.mapping); if (!imported.length) throw new Error('没有可导入的人员数据'); const seen = new Set(); const fileDuplicates = new Set(); imported.forEach(p => { const no = String(p.employeeNo || '').trim(); if (!no) return; if (seen.has(no)) fileDuplicates.add(no); seen.add(no); }); const existingNos = new Set(normalized.map(p => String(p.employeeNo || '').trim()).filter(Boolean)); const skippedNos = new Set([...fileDuplicates]); const valid = imported.filter(p => { const no = String(p.employeeNo || '').trim(); if (fileDuplicates.has(no) || existingNos.has(no)) { skippedNos.add(no); return false; } return true; }); if (!valid.length) throw new Error(`没有可导入的新人员；重复工号：${[...skippedNos].join('、') || '无'}`); const incomplete = valid.filter(p => !poPersonnelTypeOptions.includes(p.personnelType) || !p.supplier || toNumber(p.dailyCost) <= 0).length; setPersonnel(ps => [...normalized, ...valid]); setImportMsg(`已导入 ${valid.length} 条人员${skippedNos.size ? `，跳过重复工号：${[...skippedNos].join('、')}` : ''}${incomplete ? `；${incomplete} 条缺少PO必需字段（人员类型/供应商/人天成本），请补齐。` : ''}`); setImportDraft(null); } catch (err) { setImportMsg(`导入失败：${err.message}`); } };
  const poOptions = useMemo(() => buildPoPeriodOptions(demands), [demands]);
  React.useEffect(() => { if (initialPoPeriod) setPoPeriod(initialPoPeriod); }, [initialPoPeriod]);
  React.useEffect(() => { if (!initialPoPeriod && !poOptions.includes(poPeriod)) setPoPeriod(poOptions[0] || getCurrentMonthKey()); }, [initialPoPeriod, poOptions, poPeriod]);
  const poDemandRows = useMemo(() => demands.filter(d => getDemandPoPeriod(d) === poPeriod), [demands, poPeriod]);
  const teamTree = useMemo(() => buildTeamPersonnelDemandTree(normalized, demands, poPeriod), [normalized, demands, poPeriod]);
  const demandPersonnelRows = useMemo(() => buildDemandPersonnelRows(normalized, demands, poPeriod), [normalized, demands, poPeriod]);
  const poLinks = useMemo(() => buildPersonnelDemandLinks(normalized, demands, poPeriod), [normalized, demands, poPeriod]);
  const poSummary = { teamCount: new Set(poLinks.map(r => r.team)).size, peopleCount: new Set(poLinks.map(r => r.personnelId)).size, demandCount: poDemandRows.length, days: poLinks.reduce((s, r) => s + r.days, 0), cost: poLinks.reduce((s, r) => s + r.cost, 0) };
  const toggleSet = (setter, key) => setter(current => { const next = new Set(current); next.has(key) ? next.delete(key) : next.add(key); return next; });
  const monthOptions = useMemo(() => buildYearMonthOptions(defaultTrendStart), [defaultTrendStart]);
  const trendRows = useMemo(() => buildPersonnelTrendRows(normalized, demands, monthStart, monthEnd), [normalized, demands, monthStart, monthEnd]);
  const pageRangeEnd = monthEnd || monthStart;
  const rangeActivePersonnel = useMemo(() => normalized.filter(p => !pageRangeEnd || !p.entryDate || String(p.entryDate).slice(0, 7) <= pageRangeEnd), [normalized, pageRangeEnd]);
  const latestTrendRow = trendRows[trendRows.length - 1];
  const totalMonthlyDays = latestTrendRow ? latestTrendRow.availableDays : rangeActivePersonnel.reduce((s, p) => s + toNumber(p.monthlyDays), 0);
  const averageDayCost = useMemo(() => getPersonnelAverageDayCost(rangeActivePersonnel, budget), [rangeActivePersonnel, budget]);
  const demandCostRows = useMemo(() => buildDemandCostRows(demands, normalized, budget), [demands, normalized, budget]);
  const rangedDemandCostRows = useMemo(() => demandCostRows.filter(row => row.month && row.month !== '未计划' && (!monthStart || row.month >= monthStart) && (!monthEnd || row.month <= monthEnd)), [demandCostRows, monthStart, monthEnd]);
  const costTrendRows = useMemo(() => buildPersonnelCostTrendRows(normalized, demands, budget, monthStart, monthEnd), [normalized, demands, budget, monthStart, monthEnd]);
  const demandEstimatedCost = rangedDemandCostRows.reduce((sum, row) => sum + row.estimatedCost, 0);
  const demandExecutionCost = rangedDemandCostRows.reduce((sum, row) => sum + row.executionCost, 0);
  const demandBudgetAmount = rangedDemandCostRows.reduce((sum, row) => sum + row.budgetAmount, 0);
  const costGap = demandBudgetAmount - demandExecutionCost;
  const pagePersonnelRows = useMemo(() => sortRows(rangeActivePersonnel, personnelSort), [rangeActivePersonnel, personnelSort]);
  const fmt = value => Number(value || 0).toFixed(1);
  const demandIds = poDemandRows.map(d => d.id);
  const treeView = <section className="budget-exec-card"><h2>团队 → 人员 → 需求</h2><p className="muted">按选中 PO 的需求工作量明细生成，团队取人员“团队/负责人”。</p><div className="mini-table"><table><thead><tr><th>层级</th><th>人数/岗位</th><th>关联人员</th><th>关联需求</th><th>投入人天</th><th>投入费用</th><th>状态/备注</th><th>操作</th></tr></thead><tbody>{teamTree.length ? teamTree.flatMap(team => [<tr key={team.team} className="drilldown-row"><td><button className="risk-id-link" onClick={()=>toggleSet(setExpandedTeams, team.team)}>{expandedTeams.has(team.team) ? '▾' : '▸'} {team.team}</button></td><td>{team.peopleCount} 人</td><td>{team.peopleCount}</td><td>{team.demandCount}</td><td>{fmt(team.days)}</td><td>{fmt(team.cost)}w</td><td>-</td><td><button className="link neutral" onClick={()=>openDemandIds?.([...team.linkedDemandIds], `PO ${formatPoPeriod(poPeriod)} / ${team.team} 关联需求`)}>查看需求</button></td></tr>, ...(expandedTeams.has(team.team) ? team.people.flatMap(person => [<tr key={`${team.team}-${person.personnelId}`} className="person-row"><td><button className="risk-id-link" onClick={()=>toggleSet(setExpandedPeople, `${team.team}-${person.personnelId}`)}>　{expandedPeople.has(`${team.team}-${person.personnelId}`) ? '▾' : '▸'} {person.personName} / {person.employeeNo || '-'}</button></td><td>{person.position || '-'}</td><td>1</td><td>{person.demandCount}</td><td>{fmt(person.days)}</td><td>{fmt(person.cost)}w</td><td>-</td><td></td></tr>, ...(expandedPeople.has(`${team.team}-${person.personnelId}`) ? person.assignments.map(item => <tr key={item.id} className="demand-row"><td>　　<button className="risk-id-link" onClick={()=>openDemand?.(item.demandKey)}>{item.demandId}</button></td><td colSpan="2">{item.title}</td><td>{item.role}</td><td>{fmt(item.days)}</td><td>{fmt(item.cost)}w</td><td><span className="risk-badge risk-low">{item.status}</span> {item.note || '-'}</td><td></td></tr>) : [])]) : [])]) : <tr><td colSpan="8"><div className="po-view-empty">本 PO 暂无人员工作量明细。</div></td></tr>}</tbody></table></div></section>;
  const reverseView = <section className="budget-exec-card"><h2>需求 → 人员</h2><p className="muted">展示本 PO 下每个需求关联的人员、人天与费用；无人员明细的需求仍保留。</p><div className="mini-table"><table><thead><tr><th>需求ID</th><th>需求标题</th><th>状态</th><th>优先级</th><th>计划落地</th><th>人员数</th><th>涉及团队</th><th>总人天</th><th>总费用</th><th>人员摘要</th></tr></thead><tbody>{demandPersonnelRows.length ? demandPersonnelRows.flatMap(row => [<tr key={row.demandKey} className="drilldown-row"><td><button className="risk-id-link" onClick={()=>openDemand?.(row.demandKey)}>{row.demandId}</button> <button className="link neutral" onClick={()=>toggleSet(setExpandedDemands, row.demandKey)}>{expandedDemands.has(row.demandKey) ? '收起' : '展开'}</button></td><td>{row.title}</td><td><span className="risk-badge risk-low">{row.status}</span></td><td>{row.priority}</td><td>{row.landingDate || '-'}</td><td>{row.peopleCount}</td><td>{row.teams.join('、') || '-'}</td><td>{fmt(row.days)}</td><td>{fmt(row.cost)}w</td><td>{row.assignments.length ? row.assignments.map(item => `${item.personName}${fmt(item.days)}人天`).join('；') : '未选择人员'}</td></tr>, ...(expandedDemands.has(row.demandKey) ? (row.assignments.length ? row.assignments.map(item => <tr key={item.id} className="person-row"><td></td><td>{item.team}</td><td>{item.personName}</td><td>{item.employeeNo || item.position || '-'}</td><td>{item.role}</td><td colSpan="2">{item.note || '-'}</td><td>{fmt(item.days)}</td><td>{fmt(item.cost)}w</td><td></td></tr>) : [<tr key={`${row.demandKey}-empty`} className="demand-row"><td colSpan="10"><div className="po-view-empty">未选择人员，请在需求详情的工作量信息中添加人员工作量。</div></td></tr>]) : [])]) : <tr><td colSpan="10"><div className="po-view-empty">本 PO 暂无需求。</div></td></tr>}</tbody></table></div></section>;
  const trendView = <><div className="toolbar personnel-page-filter"><div><h2>人力范围筛选</h2><p className="muted">月份范围会同步影响趋势图、需求费用明细。</p></div><div className="actions"><span className="month-filter-label">月份范围：</span><label className="month-filter-control"><span>开始月份</span><MonthSelect value={monthStart} onChange={setMonthStart} options={monthOptions}/></label><label className="month-filter-control"><span>结束月份</span><MonthSelect value={monthEnd} onChange={setMonthEnd} options={monthOptions}/></label></div></div><div className="personnel-trend-grid"><section className="budget-exec-card personnel-trend-card"><h2>人力数量占用趋势分析</h2><p className="muted">按需求清单计划落地月份统计人天已占用和预占用情况。</p><ReactECharts className="budget-exec-chart" option={buildPersonnelTrendOption(trendRows)} notMerge lazyUpdate/><MiniTable rows={trendRows.map(r => ({ ...r, availableDaysText: `${fmt(r.availableDays)}人天`, occupiedDaysText: `${fmt(r.occupiedDays)}人天`, preOccupiedDaysText: `${fmt(r.preOccupiedDays)}人天`, totalOccupiedDaysText: `${fmt(r.totalOccupiedDays)}人天`, occupancyRateText: `${fmt(r.occupancyRate * 100)}%` }))} cols={[["month","月份"],["headcount","人力数量"],["availableDaysText","可用人天"],["occupiedDaysText","已占用人天"],["preOccupiedDaysText","预占用人天"],["totalOccupiedDaysText","合计占用"],["occupancyRateText","占用率"],["demandCount","需求数"]]}/></section><section className="budget-exec-card personnel-trend-card"><h2>人力费用占用分析</h2><p className="muted">来源为需求清单，按计划落地月份统计费用已占用和预占用情况。</p><ReactECharts className="budget-exec-chart" option={buildPersonnelCostTrendOption(costTrendRows)} notMerge lazyUpdate/><MiniTable rows={costTrendRows.map(r => ({ ...r, availableCostText: `${fmt(r.availableCost)}w`, occupiedCostText: `${fmt(r.occupiedCost)}w`, preOccupiedCostText: `${fmt(r.preOccupiedCost)}w`, totalOccupiedCostText: `${fmt(r.totalOccupiedCost)}w`, costOccupancyRateText: `${fmt(r.costOccupancyRate * 100)}%` }))} cols={[["month","月份"],["availableCostText","可用人力费用"],["occupiedCostText","已占用费用"],["preOccupiedCostText","预占用费用"],["totalOccupiedCostText","合计占用"],["costOccupancyRateText","费用占用率"],["demandCount","需求数"]]}/></section></div><section className="budget-exec-card"><h2>需求费用明细</h2><MiniTable rows={rangedDemandCostRows.map(r => ({ ...r, demandLink: <button className="risk-id-link" onClick={()=>openDemand?.(r.id)}>{r.demandId}</button>, dayCostText: `${fmt(r.dayCost)}w/人天`, estimatedCostText: `${fmt(r.estimatedCost)}w`, executionCostText: `${fmt(r.executionCost)}w`, budgetAmountText: `${fmt(r.budgetAmount)}w`, balanceText: `${fmt(r.balance)}w`, statusBadge: <span className={`risk-badge ${r.costStatus === '正常' ? 'risk-low' : 'risk-high'}`}>{r.costStatus}</span> }))} cols={[["demandLink","需求ID"],["title","名称"],["month","计划落地月份"],["investment","需求方"],["demandPM","需求PM"],["estimatedDays","预估人天"],["finalDays","决算人力"],["settlementDays","结算人力"],["dayCostText","成本口径"],["estimatedCostText","预估费用"],["executionCostText","执行费用"],["budgetAmountText","工作量成本"],["balanceText","费用差额"],["statusBadge","状态"]]}/></section><section className="card"><h2>角色定义清单</h2><MiniTable rows={personnelRoleDefinitions} cols={[["role","角色"],["definition","职责说明"]]}/></section></>;
  const baseView = <><div className="toolbar"><div className="actions"></div><div className="actions"><button onClick={openAddPersonnel}>新增人员</button><button onClick={downloadPersonnelImportTemplate}>下载模板</button><label className="import-btn">导入<input type="file" accept=".csv,text/csv" onChange={onImport}/></label><button onClick={()=>downloadPersonnelCsv(normalized)}>导出</button></div></div>{importMsg && <div className="notice">{importMsg}</div>}{addDraft && <div className="modal-backdrop"><div className="modal-card"><div className="modal-header"><h2>新增人员</h2><button className="secondary" onClick={()=>setAddDraft(null)}>关闭</button></div><div className="form small"><label><span className="required-label">人员姓名</span><input value={addDraft.name} placeholder="请输入姓名" onChange={e=>setAddDraft(d=>({...d,name:e.target.value}))}/></label><label><span className="required-label">工号</span><input value={addDraft.employeeNo} placeholder="请输入工号" onChange={e=>setAddDraft(d=>({...d,employeeNo:e.target.value}))}/></label><label>团队/负责人<input value={addDraft.owner} onChange={e=>setAddDraft(d=>({...d,owner:e.target.value}))}/></label><label>岗位<select value={addDraft.position} onChange={e=>setAddDraft(d=>({...d,position:e.target.value}))}>{personnelPositionOptions.map(position => <option key={position}>{position}</option>)}</select></label><label><span className="required-label">人员类型</span><select value={addDraft.personnelType} onChange={e=>setAddDraft(d=>({...d,personnelType:e.target.value}))}>{personnelTypeOptions.map(type => <option key={type}>{type}</option>)}</select></label><label><span className="required-label">供应商</span><select value={addDraft.supplier} onChange={e=>setAddDraft(d=>({...d,supplier:e.target.value}))}><option value="">未填写</option>{supplierOptions.map(supplier => <option key={supplier}>{supplier}</option>)}</select></label><label>地点<input value={addDraft.location} onChange={e=>setAddDraft(d=>({...d,location:e.target.value}))}/></label><label>入项时间<input type="date" value={addDraft.entryDate} onChange={e=>setAddDraft(d=>({...d,entryDate:e.target.value}))}/></label><label><span className="required-label">人天成本</span><input type="number" value={addDraft.dailyCost} onChange={e=>setAddDraft(d=>({...d,dailyCost:Number(e.target.value)}))}/></label><label>月度可用人天<input type="number" value={addDraft.monthlyDays} onChange={e=>setAddDraft(d=>({...d,monthlyDays:Number(e.target.value)}))}/></label></div><div className="modal-actions"><button className="secondary" onClick={()=>setAddDraft(null)}>取消</button><button className="primary inline" onClick={confirmAddPersonnel}>确认新增</button></div></div></div>}{importDraft && <section className="card import-mapping-card"><h2>导入字段映射</h2><p className="muted">系统已推荐自动映射结果。带 * 的字段为必填字段，请检查不准确的字段，改为正确的CSV表头，或选择“不导入”。</p><div className="import-mapping-table"><table><thead><tr>{personnelImportFields.map(([key, label]) => <th key={key} title={label}><span className={requiredPersonnelImportFields.has(key) ? 'required-label' : ''}>{label}</span></th>)}</tr><tr>{personnelImportFields.map(([key]) => <th key={key}><select title={importDraft.mapping[key] || '不导入'} value={importDraft.mapping[key] || ''} onChange={e=>updateImportMapping(key, e.target.value)}><option value="">不导入</option>{importDraft.headers.map(header => <option key={header} value={header} title={header}>{header}</option>)}</select></th>)}</tr></thead><tbody>{importDraft.previewRows?.length ? importDraft.previewRows.map((row, idx) => <tr key={idx}>{personnelImportFields.map(([key]) => { const value = importPreviewValue(row, key); return <td key={key} title={value}>{value}</td>; })}</tr>) : <tr><td colSpan={personnelImportFields.length}>没有可预览的数据行</td></tr>}</tbody></table></div><div className="modal-actions"><button className="secondary" onClick={()=>setImportDraft(null)}>取消</button><button className="primary inline" onClick={confirmImport}>按映射导入</button></div></section>}<div className="scroll-hint">表格可横向拖动查看全部字段</div><div className="card table-card"><table><thead><tr>{[['name','人员姓名',true],['employeeNo','工号',true],['owner','团队/负责人'],['position','岗位'],['personnelType','人员类型',true],['location','地点'],['supplier','供应商',true],['entryDate','入项时间'],['dailyCost','人天成本（元/人天）',true],['monthlyDays','月度可用人天']].map(([key,label,required]) => <th key={key}><button className="table-sort-trigger" onClick={()=>setPersonnelSort(current=>toggleSort(current, key))}><span className={required ? 'required-label' : ''}>{label}</span><span className="sort-indicator">{personnelSort.key === key ? (personnelSort.direction === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span></button></th>)}<th>操作</th></tr></thead><tbody>{pagePersonnelRows.map(p=><tr key={p.id}><td><input value={p.name} placeholder="姓名" onChange={e=>update(p.id,'name',e.target.value)}/></td><td><input value={p.employeeNo} placeholder="工号" onChange={e=>update(p.id,'employeeNo',e.target.value)}/></td><td><input value={p.owner} placeholder="团队/负责人" onChange={e=>update(p.id,'owner',e.target.value)}/></td><td><select value={p.position} onChange={e=>update(p.id,'position',e.target.value)}>{personnelPositionOptions.map(position => <option key={position}>{position}</option>)}</select></td><td><select value={p.personnelType} onChange={e=>update(p.id,'personnelType',e.target.value)}>{personnelTypeOptions.map(type => <option key={type}>{type}</option>)}</select></td><td><input value={p.location} placeholder="地点" onChange={e=>update(p.id,'location',e.target.value)}/></td><td><select value={p.supplier} onChange={e=>update(p.id,'supplier',e.target.value)}><option value="">未填写</option>{supplierOptions.map(supplier => <option key={supplier}>{supplier}</option>)}</select></td><td><input type="date" value={p.entryDate} onChange={e=>update(p.id,'entryDate',e.target.value)}/></td><td><input type="number" value={p.dailyCost} onChange={e=>update(p.id,'dailyCost',Number(e.target.value))}/></td><td><input type="number" value={p.monthlyDays} onChange={e=>update(p.id,'monthlyDays',Number(e.target.value))}/></td><td><button className="link" onClick={()=>deletePersonnel(p.id)}>删除</button></td></tr>)}</tbody></table></div></>;
  return <><Header title="人员管理" desc="按 PO 执行期间刷新团队人员，支持团队-人员-需求与需求-人员双向钻取。"/><section className="personnel-page-filter"><div className="toolbar"><div><h2>PO执行期间</h2><p className="muted">当前页按需求工作量明细中的人员分配关系生成。</p></div><div className="actions"><input type="month" value={poPeriod} onChange={e=>setPoPeriod(e.target.value)}/><button onClick={()=>openDemandIds?.(demandIds, `PO ${formatPoPeriod(poPeriod)} 需求`)}>查看本 PO 需求</button></div></div></section><div className="kpi-grid"><Kpi label="PO期间" value={formatPoPeriod(poPeriod)}/><Kpi label="关联团队数" value={`${poSummary.teamCount} 个`}/><Kpi label="关联人员数" value={`${poSummary.peopleCount} 人`}/><Kpi label="关联需求数" value={`${poSummary.demandCount} 个`}/><Kpi label="投入人天/费用" value={`${fmt(poSummary.days)} 人天`} sub={`${fmt(poSummary.cost)}w`}/></div><div className="tab-bar"><button className={activeTab === 'base' ? 'active' : ''} onClick={()=>setActiveTab('base')}>人员基础信息</button><button className={activeTab === 'team' ? 'active' : ''} onClick={()=>setActiveTab('team')}>团队 → 人员 → 需求</button><button className={activeTab === 'demand' ? 'active' : ''} onClick={()=>setActiveTab('demand')}>需求 → 人员</button><button className={activeTab === 'trend' ? 'active' : ''} onClick={()=>setActiveTab('trend')}>趋势与成本</button></div>{activeTab === 'team' && treeView}{activeTab === 'demand' && reverseView}{activeTab === 'trend' && trendView}{activeTab === 'base' && baseView}</>;
}


function BudgetManagementPage({ demands, budget, setBudget, personnel = [], openDemandIds }) {
  const sourceRows = useMemo(() => buildDemandBudgetSourceRows(demands, budget, personnel), [demands, budget, personnel]);
  const poolRows = useMemo(() => buildBudgetPoolRows(demands, budget, personnel), [demands, budget, personnel]);
  const demandPools = useMemo(() => otherBudgetSourceOptions.map(source => (budget.pools || []).find(pool => !isDepartmentBaselinePool(pool) && [pool.name, pool.ownerDept].some(value => String(value || '').includes(source))) || { id: `pool-other-${source}`, name: `${source}预算池`, ownerDept: source, type: 'other', month: '', amount: 0, description: '其他预算来源，按需维护金额', sourceType: '其他', sourceName: source, sourceOwner: source, sourceCode: '', approvedAt: '', sourceNote: '' }), [budget]);
  const baselinePools = useMemo(() => (budget.pools || []).filter(pool => isDepartmentBaselinePool(pool)), [budget]);
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
  const emptySourceFields = { sourceType: '', sourceName: '', sourceOwner: '', sourceCode: '', approvedAt: '', sourceNote: '' };
  const addDemandPool = () => updatePools(pools => [...pools, { id: `pool-demand-${Date.now()}`, name: '需求方预算池', ownerDept: '', type: 'demand-side', month: '', amount: 0, description: '需求方提供预算', ...emptySourceFields }]);
  const addBaselinePool = () => updatePools(pools => [...pools, { id: `pool-baseline-${Date.now()}`, name: `${baselineDemandParty}预算池`, ownerDept: baselineDemandParty, type: 'department-baseline', month: '', amount: 0, description: '部门基线预算', ...emptySourceFields }]);
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
    <td className={(row.remaining ?? ((row.amount || 0) - (row.demandBudget || 0))) < 0 ? 'field-error' : ''}>{fmt(row.remaining ?? ((row.amount || 0) - (row.demandBudget || 0)))}w</td>
    <td>{fmt(row.overAmount || 0)}w</td>
    <td><span className={`risk-badge ${statusClass(row.status || '正常')}`}>{row.status || '正常'}</span></td>
    <td><input value={row.sourceType || ''} onChange={e=>updatePool(row.id,'sourceType',e.target.value)}/></td>
    <td><input value={row.sourceName || ''} onChange={e=>updatePool(row.id,'sourceName',e.target.value)}/></td>
    <td><input value={row.sourceOwner || ''} onChange={e=>updatePool(row.id,'sourceOwner',e.target.value)}/></td>
    <td><input value={row.sourceCode || ''} onChange={e=>updatePool(row.id,'sourceCode',e.target.value)}/></td>
    <td><input type="date" value={row.approvedAt || ''} onChange={e=>updatePool(row.id,'approvedAt',e.target.value)}/></td>
    <td><input value={row.sourceNote || ''} onChange={e=>updatePool(row.id,'sourceNote',e.target.value)}/></td>
    <td><input value={row.description || ''} onChange={e=>updatePool(row.id,'description',e.target.value)}/></td>
    <td><button className="link" onClick={()=>deletePool(row.id)}>删除</button></td>
  </tr>) : <tr><td colSpan="19">暂无{editableType}预算池。</td></tr>;
  return <div className="budget-exec-dashboard">
    <Header title="预算管理" desc="上方汇总预算来源全貌，下方分别维护需求类预算和部门基线预算，作为预算与风险分析的基础数据来源。"/>
    <section className="budget-exec-layer"><h2>预算概览</h2><div className="kpi-grid"><Kpi label="预算池总额" value={`${fmt(totalPoolAmount)}w`}/><Kpi label="来源于需求的预算" value={`${fmt(demandPoolAmount)}w`} sub={`工作量成本占用 ${fmt(summary.demandBudget)}w`}/><Kpi label="来源于基线的预算" value={`${fmt(summary.baselineAmount)}w`}/><Kpi label="已占用预算" value={`${fmt(totalOccupied)}w`}/><Kpi label="预算剩余" value={`${fmt(totalPoolAmount - totalOccupied)}w`} tone={totalPoolAmount - totalOccupied < 0 ? 'danger' : 'ok'}/></div><div className="kpi-grid four"><Kpi label="工作量成本占用" value={`${fmt(demandPoolOccupied)}w`} sub="匹配需求方预算池"/><Kpi label="基线预算占用" value={`${fmt(baselinePoolOccupied)}w`} sub="匹配部门基线预算池"/><Kpi label="无预算需求数" value={`${summary.noBudgetCount} 个`} tone={summary.noBudgetCount>0?'danger':'ok'}/><Kpi label="超额预算池" value={`${poolRows.filter(row => ['已超额', '无预算池'].includes(row.status)).length} 个`} tone={poolRows.some(row => ['已超额', '无预算池'].includes(row.status))?'danger':'ok'}/><Kpi label="预算来源数" value={`${summary.sourceCount} 个`}/></div></section>
    <section className="budget-exec-card"><h2>需求池预算来源汇总</h2><p className="muted">来自需求池“需求方/人员工作量明细/预算状态”的占用视角，用于说明工作量成本构成。</p><MiniTable rows={sourceRows.map(r => ({ ...r, demandCountLink: <button className="risk-id-link" onClick={()=>openDemandIds?.(r.demandIds, `预算来源「${r.source}」关联需求`)}>{r.demandCount}</button>, budgetAmountText: `${fmt(r.budgetAmount)}w`, executionCostText: `${fmt(r.executionCost)}w / ${fmt(r.executionDays)}人天`, acquiredText: `${fmt(r.acquired)}w`, committedText: `${fmt(r.committed)}w`, overdueText: `${fmt(r.overdue)}w` }))} cols={[["source","预算来源/需求方"],["demandCountLink","需求数"],["budgetAmountText","工作量成本"],["executionCostText","执行成本估算"],["acquiredText","已获取"],["committedText","已承诺未获取"],["overdueText","获取超期"],["noBudgetCount","无预算需求数"],["matchedPoolsText","匹配预算池"]]}/></section>
    <section className="budget-exec-card"><div className="toolbar"><h2>需求类预算池</h2><div className="actions"><button onClick={addDemandPool}>新增需求类预算</button></div></div><p className="muted">需求方提供的预算池，通常按制造、审计、供应、财经等需求方维护。需求会按需求方自动匹配并扣减。</p><div className="mini-table"><table><thead><tr>{['预算池名称','所属需求方','类型','月份/年度','历史/参考预算金额w','匹配需求数','工作量成本占用w','执行成本占用w','剩余w','超额w','状态','来源类型','来源名称','来源负责人/部门','预算编号','审批日期','来源说明','说明','操作'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{renderPoolRows(demandPoolRows, '需求类')}</tbody></table></div></section>
    <section className="budget-exec-card"><div className="toolbar"><h2>基线类预算池</h2><div className="actions"><button onClick={addBaselinePool}>新增基线类预算</button></div></div><p className="muted">部门基线预算包括 OBP、存量运营、差评、零星等基线来源。管理员维护后会实时影响风险判断。</p><div className="mini-table"><table><thead><tr>{['预算池名称','所属部门','类型','月份/年度','历史/参考预算金额w','匹配需求数','工作量成本占用w','执行成本占用w','剩余w','超额w','状态','来源类型','来源名称','来源负责人/部门','预算编号','审批日期','来源说明','说明','操作'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{renderPoolRows(baselinePoolRows, '基线类')}</tbody></table></div></section>
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
      { name: '工作量成本占用', type: 'bar', data: rows.map(r => Number(r.demandBudget.toFixed(1))) },
      { name: '执行成本占用', type: 'bar', data: rows.map(r => Number(r.executionCost.toFixed(1))) },
      { name: '超额金额', type: 'bar', data: rows.map(r => Number(r.overAmount.toFixed(1))), itemStyle: { color: '#dc2626' } },
      { name: '累计使用率', type: 'line', yAxisIndex: 1, smooth: true, data: rows.map(r => Number((r.cumulativePoolAmount > 0 ? r.cumulativeDemandBudget / r.cumulativePoolAmount * 100 : 0).toFixed(1))), markLine: { symbol: 'none', lineStyle: { color: '#dc2626', type: 'dashed' }, label: { formatter: '100%耗尽线' }, data: [{ yAxis: 100 }] } }
    ]
  };
}


function PurchaseOrderManagementPage({ purchaseOrders = [], setPurchaseOrders }) {
  const [supplierFilter, setSupplierFilter] = useState('全部');
  const [typeFilter, setTypeFilter] = useState('全部');
  const [monthFilter, setMonthFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [expandedPersonnel, setExpandedPersonnel] = useState(() => new Set());
  const [expandedDemands, setExpandedDemands] = useState(() => new Set());
  const orders = purchaseOrders.map(normalizePurchaseOrder);
  const filtered = orders.filter(order => {
    const kw = keyword.trim().toLowerCase();
    const matchesSupplier = supplierFilter === '全部' || order.supplier === supplierFilter;
    const matchesType = typeFilter === '全部' || order.personnelType === typeFilter;
    const matchesMonth = !monthFilter || order.poPeriod === monthFilter;
    const matchesKeyword = !kw || [order.poNo, ...(order.personnelSnapshot || []).flatMap(p => [p.name, p.employeeNo])].some(value => String(value || '').toLowerCase().includes(kw));
    return matchesSupplier && matchesType && matchesMonth && matchesKeyword;
  });
  const summary = buildPurchaseOrderSummary(filtered);
  const grouped = [...filtered.reduce((map, order) => {
    const key = `${order.supplier || '未填写'}-${order.personnelType}`;
    const row = map.get(key) || { key, supplier: order.supplier || '未填写', personnelType: order.personnelType, count: 0, manDays: 0, cost: 0 };
    row.count += 1; row.manDays += toNumber(order.totalManDays); row.cost += toNumber(order.estimatedTotalCost); map.set(key, row);
    return map;
  }, new Map()).values()];
  const fmt = value => Number(value || 0).toFixed(1);
  const toggleSet = (setter, key) => setter(current => { const next = new Set(current); next.has(key) ? next.delete(key) : next.add(key); return next; });
  const deleteOrder = id => { if (confirm('确认删除该 PO 记录？')) setPurchaseOrders?.(orders => orders.filter(order => order.id !== id)); };
  const exportCsv = () => {
    const headers = ['PO号','创建时间','供应商','人员类型','开始日期','结束日期','有效工作日','总人天','预计总成本w','人员数','关联需求数','备注'];
    const lines = [headers.join(',')].concat(filtered.map(o => [o.poNo,o.createdAt,o.supplier,o.personnelType,o.startDate,o.endDate,o.effectiveWorkdays,o.totalManDays,o.estimatedTotalCost,o.personnelSnapshot.length,o.demandLinks.length,o.note].map(v=>`"${String(v ?? '').replaceAll('"','""')}"`).join(',')));
    const blob = new Blob(['\ufeff' + lines.join('\n')], {type:'text/csv;charset=utf-8'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'purchase-orders.csv'; a.click();
  };
  return <div className="budget-exec-dashboard"><Header title="PO管理" desc="查看从人力日历下发的 PO 记录，按供应商和人员类型分别汇总成本、人天与有效工作日。"/><div className="kpi-grid"><Kpi label="PO记录数" value={`${summary.count} 条`}/><Kpi label="PO总人天" value={`${fmt(summary.manDays)} 人天`}/><Kpi label="PO总成本" value={`${fmt(summary.cost)}w`}/><Kpi label="TM PO成本/人天" value={`${fmt(summary.byType.TM.cost)}w`} sub={`${fmt(summary.byType.TM.manDays)} 人天`}/><Kpi label="OD PO成本/人天" value={`${fmt(summary.byType.OD.cost)}w`} sub={`${fmt(summary.byType.OD.manDays)} 人天`}/></div><div className="toolbar"><div className="actions"><select value={supplierFilter} onChange={e=>setSupplierFilter(e.target.value)}><option>全部</option>{supplierOptions.map(item => <option key={item}>{item}</option>)}</select><select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option>全部</option>{poPersonnelTypeOptions.map(item => <option key={item}>{item}</option>)}</select><input type="month" value={monthFilter} onChange={e=>setMonthFilter(e.target.value)}/><input value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder="PO号/人员姓名/工号"/></div><div className="actions"><button onClick={exportCsv}>导出CSV</button></div></div><section className="budget-exec-card"><h2>按供应商 + 人员类型汇总</h2><MiniTable rows={grouped.map(r => ({ ...r, manDaysText: `${fmt(r.manDays)} 人天`, costText: `${fmt(r.cost)}w` }))} cols={[["supplier","供应商"],["personnelType","人员类型"],["count","PO数量"],["manDaysText","总人天"],["costText","总成本"]]}/></section><section className="budget-exec-card"><h2>PO记录</h2><div className="mini-table"><table><thead><tr>{['PO号','创建时间','供应商','人员类型','PO时间范围','有效工作日','总人天','预计总成本','人员数','关联需求数','备注','操作'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{filtered.length ? filtered.flatMap(order => [<tr key={order.id}><td>{order.poNo}</td><td>{new Date(order.createdAt).toLocaleString()}</td><td>{order.supplier}</td><td>{order.personnelType}</td><td>{order.startDate} ~ {order.endDate}</td><td>{fmt(order.effectiveWorkdays)}</td><td>{fmt(order.totalManDays)}</td><td>{fmt(order.estimatedTotalCost)}w</td><td>{order.personnelSnapshot.length}</td><td>{order.demandLinks.length}</td><td>{order.note || '-'}</td><td><button className="link neutral" onClick={()=>toggleSet(setExpandedPersonnel, order.id)}>{expandedPersonnel.has(order.id) ? '收起人员' : '人员明细'}</button><button className="link neutral" onClick={()=>toggleSet(setExpandedDemands, order.id)}>{expandedDemands.has(order.id) ? '收起需求' : '需求明细'}</button><button className="link" onClick={()=>deleteOrder(order.id)}>删除</button></td></tr>, ...(expandedPersonnel.has(order.id) ? [<tr key={`${order.id}-people`} className="detail-row"><td colSpan="12"><MiniTable rows={order.personnelSnapshot.map(p => ({ ...p, dailyCostText: `${fmt(p.dailyCost)} 元/人天`, manDaysText: `${fmt(p.manDays)} 人天`, costText: `${fmt(p.cost)}w` }))} cols={[["name","姓名"],["employeeNo","工号"],["owner","团队"],["position","岗位"],["supplier","供应商"],["personnelType","人员类型"],["dailyCostText","人天成本"],["manDaysText","本次人天"],["costText","本次成本"]]}/></td></tr>] : []), ...(expandedDemands.has(order.id) ? [<tr key={`${order.id}-demands`} className="detail-row"><td colSpan="12"><MiniTable rows={order.demandLinks.map(d => ({ ...d, daysText: `${fmt(d.days)} 人天`, costText: `${fmt(d.cost)}w` }))} cols={[["demandId","需求ID"],["title","需求"],["status","状态"],["priority","优先级"],["landingDate","计划落地"],["personName","人员"],["employeeNo","工号"],["role","角色"],["daysText","需求人天"],["costText","需求成本"]]}/></td></tr>] : [])]) : <tr><td colSpan="12">暂无 PO 记录</td></tr>}</tbody></table></div></section></div>;
}

function BudgetRiskAnalysisPage({ demands, budget, setBudget, personnel = [], purchaseOrders = [], openDemand, openDemandFilter, openDemandIds }) {
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
  const poolRows = useMemo(() => buildBudgetPoolRows(safeDemands, budget, personnel), [safeDemands, budget, personnel]);
  const allMonthlyRows = useMemo(() => buildMonthlyBudgetOccupationRows(safeDemands, budget, personnel), [safeDemands, budget, personnel]);
  const monthlyRows = useMemo(() => allMonthlyRows.filter(row => (row.month === '未计划' || row.month === '年度/长期') ? !monthStart && !monthEnd : (!monthStart || row.month >= monthStart) && (!monthEnd || row.month <= monthEnd)), [allMonthlyRows, monthStart, monthEnd]);
  const demandRows = useMemo(() => buildBudgetOccupationDemandRows(safeDemands, budget, personnel), [safeDemands, budget, personnel]);
  const summary = useMemo(() => buildBudgetPoolSummary(poolRows, allMonthlyRows), [poolRows, allMonthlyRows]);
  const riskRows = useMemo(() => buildBudgetRiskRows(safeDemands, budget, personnel), [safeDemands, budget, personnel]);
  const riskDetailRows = riskRows.filter(row => {
    const matchesIds = !filteredRiskIds || filteredRiskIds.includes(row.id);
    const matchesLevel = riskLevelFilter === '全部' ? true : riskLevelFilter === 'nonLow' ? row.riskLevel !== 'low' : row.riskLevel === riskLevelFilter;
    const matchesCategory = riskCategoryFilter === '全部' || row.triggeredRules.some(rule => rule.category === riskCategoryFilter);
    return matchesIds && matchesLevel && matchesCategory;
  });
  const riskSummary = useMemo(() => buildBudgetRiskSummary(riskRows, budget), [riskRows, budget]);
  const executorRows = useMemo(() => buildExecutorExecutionRows(safeDemands, budget, monthKey), [safeDemands, budget, monthKey]);
  const sourceRows = useMemo(() => buildBudgetSourceExecutionRows(safeDemands, budget, personnel), [safeDemands, budget, personnel]);
  const executionDemandRows = useMemo(() => buildBudgetExecutionDemandRows(safeDemands, budget), [safeDemands, budget]);
  const executionSummary = useMemo(() => buildBudgetExecutionSummary(executorRows, sourceRows), [executorRows, sourceRows]);
  const poRelationSummary = useMemo(() => buildBudgetPoRelationSummary({ demands: safeDemands, budget, purchaseOrders }), [safeDemands, budget, purchaseOrders]);
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
    <Header title="预算与风险分析" desc="统一维护预算池，按工作量成本和执行成本动态扣减，并集中查看月度占用、风险规则和执行分析。"/>
    <div className="tab-bar">{[['pools','预算池总览'],['monthly','月度预算占用'],['details','需求占用明细'],['poRelation','预算-PO-结算'],['risk','风险分析'],['execution','执行分析']].map(([key,label]) => <button key={key} className={activeTab===key?'active':''} onClick={()=>setActiveTab(key)}>{label}</button>)}</div>
    {activeTab === 'pools' && <>
      <div className="kpi-grid"><Kpi label="预算池总额" value={`${fmt(summary.totalAmount)}w`}/><Kpi label="工作量成本占用" value={`${fmt(summary.demandBudget)}w`}/><Kpi label="执行成本占用" value={`${fmt(summary.executionCost)}w`}/><Kpi label="剩余额度" value={`${fmt(summary.remaining)}w`} tone={summary.remaining<0?'danger':'ok'}/><Kpi label="超额预算池" value={`${summary.overPoolCount} 个`} tone={summary.overPoolCount>0?'danger':'ok'}/></div><div className="kpi-grid"><Kpi label="已创建PO成本" value={`${fmt(poRelationSummary.poCost)}w`}/><Kpi label="预算-PO差异" value={`${fmt(poRelationSummary.budgetPoDiff)}w`} tone={poRelationSummary.budgetPoDiff<0?'danger':'ok'}/><Kpi label="PO-结算差异" value={`${fmt(poRelationSummary.poSettlementDiff)}w`} tone={poRelationSummary.poSettlementDiff<0?'danger':'ok'}/><Kpi label="TM PO成本" value={`${fmt(poRelationSummary.poSummary.byType.TM.cost)}w`} sub={`${fmt(poRelationSummary.poSummary.byType.TM.manDays)} 人天`}/><Kpi label="OD PO成本" value={`${fmt(poRelationSummary.poSummary.byType.OD.cost)}w`} sub={`${fmt(poRelationSummary.poSummary.byType.OD.manDays)} 人天`}/></div>
      <div className="budget-exec-chart-grid"><section className="budget-exec-card"><h2>预算池使用率排行</h2><p className="muted">计算规则：预算池使用率 = 已匹配需求的人员工作量成本占用 ÷ 预算池金额；人员工作量成本 = 人天 × 人员日单价 / 10000。未选择人员的需求不计入占用，并在表格中计入“未计成本需求数”。</p><ReactECharts className="budget-exec-chart" option={buildBudgetPoolUsageOption(poolRows)} notMerge lazyUpdate/></section><section className="budget-exec-card"><h2>预算池状态分布</h2><ReactECharts className="budget-exec-chart" option={buildBudgetPoolStatusOption(poolRows)} notMerge lazyUpdate/></section></div>
      <section className="budget-exec-card"><div className="toolbar"><h2>预算池维护与占用结果</h2><div className="actions"><button onClick={addPool}>新增预算池</button></div></div>{poolError && <p className="field-error">{poolError}</p>}<div className="mini-table"><table><thead><tr>{['预算池名称','所属需求方/部门','类型','月份/年度','预算金额w','需求数','工作量成本占用w','未计成本需求数','执行成本占用w','剩余w','使用率','状态','来源名称','来源负责人/部门','说明','操作'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{(budget.pools || []).map(pool => { const row = poolRows.find(item => item.id === pool.id) || {}; return <tr key={pool.id}><td><input value={pool.name} onChange={e=>updatePool(pool.id,'name',e.target.value)}/></td><td><input value={pool.ownerDept} onChange={e=>updatePool(pool.id,'ownerDept',e.target.value)}/></td><td><select value={pool.type} onChange={e=>updatePool(pool.id,'type',e.target.value)}>{budgetPoolTypes.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></td><td><input type="month" value={pool.month || ''} onChange={e=>updatePool(pool.id,'month',e.target.value)}/></td><td><input type="number" min="0" value={pool.amount} onChange={e=>updatePool(pool.id,'amount',e.target.value)}/></td><td>{row.demandCount || 0}</td><td>{fmt(row.demandBudget)}w</td><td>{row.missingCostDemandCount || 0}</td><td>{fmt(row.executionCost)}w</td><td>{fmt(row.remaining)}w</td><td>{Number.isFinite(row.usageRate) ? `${(row.usageRate * 100).toFixed(1)}%` : '无预算'}</td><td>{statusBadge(row.status || '正常')}</td><td><input value={pool.sourceName || ''} onChange={e=>updatePool(pool.id,'sourceName',e.target.value)}/></td><td><input value={pool.sourceOwner || ''} onChange={e=>updatePool(pool.id,'sourceOwner',e.target.value)}/></td><td><input value={pool.description || ''} onChange={e=>updatePool(pool.id,'description',e.target.value)}/></td><td><button className="link" onClick={()=>deletePool(pool.id)}>删除</button></td></tr>; })}{poolRows.filter(row => row.id === '__unmatched__').map(row => <tr key={row.id}><td>{row.name}</td><td>{row.ownerDept}</td><td>{row.typeLabel}</td><td>{row.month}</td><td>{fmt(row.amount)}w</td><td>{row.demandCount}</td><td>{fmt(row.demandBudget)}w</td><td>{row.missingCostDemandCount || 0}</td><td>{fmt(row.executionCost)}w</td><td>{fmt(row.remaining)}w</td><td>无预算</td><td>{statusBadge(row.status)}</td><td>{row.sourceName || '-'}</td><td>{row.sourceOwner || '-'}</td><td>{row.description}</td><td>-</td></tr>)}</tbody></table></div></section>
    </>}
    {activeTab === 'monthly' && <><div className="toolbar"><div className="actions"><span className="month-filter-label">占用月份：</span><label className="month-filter-control"><span>开始月份</span><MonthSelect value={monthStart} onChange={setMonthStart} options={monthOptions}/></label><label className="month-filter-control"><span>结束月份</span><MonthSelect value={monthEnd} onChange={setMonthEnd} options={monthOptions}/></label></div></div><section className="budget-exec-card"><h2>月度预算占用趋势</h2><ReactECharts className="budget-exec-chart" option={buildMonthlyBudgetOccupationOption(monthlyRows)} notMerge lazyUpdate/></section><section className="budget-exec-card"><h2>月度预算占用汇总</h2><MiniTable rows={monthlyRows.map(r => ({ ...r, poolAmountText: `${fmt(r.poolAmount)}w`, demandBudgetText: `${fmt(r.demandBudget)}w`, executionCostText: `${fmt(r.executionCost)}w`, cumulativeDemandBudgetText: `${fmt(r.cumulativeDemandBudget)}w`, cumulativeExecutionCostText: `${fmt(r.cumulativeExecutionCost)}w`, remainingText: `${fmt(r.remaining)}w`, overAmountText: `${fmt(r.overAmount)}w`, statusBadge: statusBadge(r.status) }))} cols={[["month","月份"],["poolAmountText","当月预算池额度"],["demandBudgetText","当月工作量成本占用"],["executionCostText","当月执行成本占用"],["cumulativeDemandBudgetText","累计工作量成本占用"],["cumulativeExecutionCostText","累计执行成本占用"],["remainingText","剩余额度"],["overAmountText","超额金额"],["demandCount","涉及需求数"],["statusBadge","结论"]]}/></section></>}
    {activeTab === 'details' && <section className="budget-exec-card"><h2>需求占用明细</h2><MiniTable rows={demandRows.map(r => ({ ...r, demandLink: <button className="risk-id-link" onClick={()=>openDemand(r.id)}>{r.demandId}</button>, budgetSourceText: r.budgetSourceType === '其他' ? `其他-${r.budgetSource || '-'}` : r.budgetSourceType, budgetAmountText: `${fmt(r.budgetAmount)}w`, executionCostText: `${fmt(r.executionCost)}w`, poolRemainingText: `${fmt(r.poolRemaining)}w`, poolStatusBadge: statusBadge(r.poolStatus), budgetInsufficientText: r.budgetInsufficient ? '是' : '否' }))} cols={[["demandLink","需求ID"],["title","名称"],["source","类型"],["investment","需求方"],["budgetSourceText","预算来源"],["budgetPoolName","匹配预算池"],["budgetAmountText","工作量成本"],["executionCostText","执行成本"],["poolRemainingText","预算池剩余"],["budgetStatusLabel","预算状态"],["occupationMonth","占用月份"],["demandBA","需求BA"],["demandPM","需求PM"],["status","需求状态"],["poolStatusBadge","预算池状态"],["budgetInsufficientText","是否超额"]]}/></section>}
    {activeTab === 'poRelation' && <><div className="kpi-grid"><Kpi label="预算池总额" value={`${fmt(poRelationSummary.budgetPoolAmount)}w`}/><Kpi label="需求执行估算成本" value={`${fmt(poRelationSummary.demandExecutionCost)}w`}/><Kpi label="已创建PO成本" value={`${fmt(poRelationSummary.poCost)}w`}/><Kpi label="结算成本" value={`${fmt(poRelationSummary.settlementCost)}w`}/><Kpi label="预算-PO差异" value={`${fmt(poRelationSummary.budgetPoDiff)}w`} tone={poRelationSummary.budgetPoDiff<0?'danger':'ok'}/></div><section className="budget-exec-card"><h2>预算、需求、PO、结算关系</h2><MiniTable rows={[{ item: '预算池总额', amount: `${fmt(poRelationSummary.budgetPoolAmount)}w`, rule: 'budget.pools 中预算池金额合计' }, { item: '需求执行估算成本', amount: `${fmt(poRelationSummary.demandExecutionCost)}w`, rule: '执行人天 × 预算人天成本口径' }, { item: '已创建 PO 成本', amount: `${fmt(poRelationSummary.poCost)}w`, rule: 'purchaseOrders.estimatedTotalCost 汇总' }, { item: '结算成本', amount: `${fmt(poRelationSummary.settlementCost)}w`, rule: '需求结算人力 × 预算人天成本口径' }, { item: '预算-PO差异', amount: `${fmt(poRelationSummary.budgetPoDiff)}w`, rule: '预算池总额 - 已创建 PO 成本' }, { item: '需求估算-PO差异', amount: `${fmt(poRelationSummary.demandPoDiff)}w`, rule: '需求执行估算成本 - 已创建 PO 成本' }, { item: 'PO-结算差异', amount: `${fmt(poRelationSummary.poSettlementDiff)}w`, rule: '已创建 PO 成本 - 结算成本' }]} cols={[["item","项目"],["amount","金额"],["rule","计算口径"]]}/></section><section className="budget-exec-card"><h2>按人员类型 PO 汇总</h2><MiniTable rows={poPersonnelTypeOptions.map(type => ({ type, count: poRelationSummary.poSummary.byType[type].count, manDays: `${fmt(poRelationSummary.poSummary.byType[type].manDays)} 人天`, cost: `${fmt(poRelationSummary.poSummary.byType[type].cost)}w` }))} cols={[["type","人员类型"],["count","PO数"],["manDays","人天"],["cost","成本"]]}/></section></>}
    {activeTab === 'risk' && <><div className="toolbar"><div className="actions"><span className="muted">预算池和需求池变化会实时重算风险。</span></div><div className="actions"><button onClick={()=>downloadBudgetRiskCsv(riskDetailRows)}>导出</button></div></div>{filteredRiskIds && <div className="notice">{filteredRiskLabel}：当前展示 {riskDetailRows.length} 条风险需求 <button className="link neutral" onClick={()=>{ setFilteredRiskIds(null); setFilteredRiskLabel(''); setRiskLevelFilter('nonLow'); }}>清除筛选</button></div>}<section className="risk-layer"><h2>整体风险</h2><div className="kpi-grid four"><Kpi label="高风险需求" value={`${riskSummary.highRiskCount} 个`} tone={riskSummary.highRiskCount>0?'danger':'ok'}/><Kpi label="中风险需求" value={`${riskSummary.mediumRiskCount} 个`} tone={riskSummary.mediumRiskCount>0?'danger':'ok'}/><Kpi label="风险人天" value={`${riskSummary.gapDays} 人天`} tone={riskSummary.gapDays>0?'danger':'ok'}/><Kpi label="预算金额缺口" value={`${riskSummary.amountGap.toFixed(1)}w`} tone={riskSummary.amountGap>0?'danger':'ok'}/></div><div className="risk-chart-grid"><section className="risk-chart-card"><h2>风险等级分布</h2><ReactECharts className="risk-chart" option={buildRiskLevelOption(riskRows)} notMerge lazyUpdate/></section><section className="risk-chart-card"><h2>风险规则分类分布</h2><ReactECharts className="risk-chart" option={buildRiskCategoryOption(riskRows)} notMerge lazyUpdate/></section><section className="risk-chart-card"><h2>预算状态分布</h2><ReactECharts className="risk-chart" option={buildBudgetDonutOption(riskRows)} notMerge lazyUpdate/></section><section className="risk-chart-card"><h2>各状态人力投入与预算覆盖</h2><ReactECharts className="risk-chart" option={buildStatusBudgetOption(riskRows)} notMerge lazyUpdate/></section></div></section><section className="risk-table-card"><div className="toolbar"><h2>预算风险明细表</h2><div className="risk-filter-tags"><button className={riskLevelFilter==='nonLow'?'active':''} onClick={()=>setRiskLevelFilter('nonLow')}>中高风险</button><button className={riskLevelFilter==='high'?'active':''} onClick={()=>setRiskLevelFilter('high')}>高风险</button><button className={riskLevelFilter==='medium'?'active':''} onClick={()=>setRiskLevelFilter('medium')}>中风险</button><button className={riskLevelFilter==='low'?'active':''} onClick={()=>setRiskLevelFilter('low')}>低风险</button><button className={riskLevelFilter==='全部'?'active':''} onClick={()=>setRiskLevelFilter('全部')}>全部等级</button>{['全部', ...new Set(riskRules.map(rule => rule.category))].map(category => <button key={category} className={riskCategoryFilter===category?'active':''} onClick={()=>setRiskCategoryFilter(category)}>{category}</button>)}</div></div><div className="mini-table risk-detail-table"><table><thead><tr><th>需求ID</th><th>名称</th><th>状态</th><th>计划落地</th><th>人力</th><th>预算来源</th><th>工作量成本</th><th>预算池</th><th>预算池剩余</th><th>预算池状态</th><th>超额金额</th><th>人员工作量明细</th><th>风险等级</th><th>命中规则</th><th>建议操作</th></tr></thead><tbody>{riskDetailRows.map(row => <tr key={row.id} className={`risk-row-${row.riskLevel}`}><td><button className="risk-id-link" onClick={()=>openDemand(row.id)}>{row.demandNo || row.rr || row.id}</button></td><td>{row.title}</td><td>{row.status}</td><td>{row.landingDate || '未排期'}</td><td>{row.days}</td><td>{row.budgetSourceType === '其他' ? `其他-${row.budgetSource || '-'}` : row.budgetSourceType}</td><td>{fmt(row.workloadCost ?? row.budget)}w</td><td>{row.budgetPoolName}</td><td className={row.poolRemaining < 0 ? 'field-error' : ''}>{fmt(row.poolRemaining)}w</td><td>{statusBadge(row.poolStatus)}</td><td className={row.poolOverAmount > 0 ? 'field-error' : ''}>{fmt(row.poolOverAmount)}w</td><td className="risk-reason-cell">{row.missingPersonnelCost ? '未选择人员，预算占用未计算' : row.personnelWorkloadText}</td><td><span className={`risk-badge risk-${row.riskLevel}`}>{row.riskText}</span></td><td className="risk-reason-cell">{row.triggeredRules.map(rule => rule.name).join('；')}</td><td className="risk-reason-cell">{row.action}</td></tr>)}</tbody></table></div></section><RiskRulesPage rows={riskRows} openDemandIds={openDemandIds}/></>}
    {activeTab === 'execution' && <><div className="toolbar"><div className="actions"><input type="month" value={monthKey} onChange={e=>setMonthKey(e.target.value)}/></div><div className="actions"><button onClick={()=>downloadBudgetExecutionCsv(executorRows, sourceRows, executionDemandRows)}>导出</button></div></div><div className="kpi-grid"><Kpi label="当月执行人天" value={`${fmt(executionSummary.monthlyExecutionDays)} 人天`}/><Kpi label="超饱和需求PM数" value={`${executionSummary.overloadedExecutors} 人`} tone={executionSummary.overloadedExecutors>0?'danger':'ok'}/><Kpi label="预算池总额" value={`${fmt(executionSummary.budgetAmount)}w`}/><Kpi label="执行/占用预算" value={`${fmt(executionSummary.occupiedCost)}w`}/><Kpi label="超执行预算池数" value={`${executionSummary.overBudgetSources} 个`} tone={executionSummary.overBudgetSources>0?'danger':'ok'}/></div><section className="budget-exec-layer"><h2>当月PM饱和与预算支撑</h2><section className="budget-exec-card"><h2>当月需求PM饱和度</h2>{executorRows.length ? <ReactECharts className="budget-exec-chart" option={buildExecutorSaturationOption(executorRows, budget)} notMerge lazyUpdate/> : <p className="empty">当前月份暂无已排期需求</p>}</section><section className="budget-exec-card"><h2>需求PM明细</h2><MiniTable rows={executorRows.map(r => ({ ...r, executionDays: fmt(r.executionDays), saturationText: `${(r.saturation*100).toFixed(1)}%`, estimatedCost: `${fmt(r.estimatedCost)}w`, supportRateText: `${(r.supportRate*100).toFixed(1)}%`, conclusionBadge: statusBadge(r.conclusion) }))} cols={[["demandPM","需求PM"],["demandCount","当月需求数"],["executionDays","执行人天"],["saturationText","饱和度"],["estimatedCost","估算成本"],["supportRateText","预算支撑率"],["conclusionBadge","结论"]]}/></section></section><section className="budget-exec-layer"><h2>预算池/需求方执行占用</h2><div className="budget-exec-chart-grid"><section className="budget-exec-card"><h2>预算池执行占用</h2><ReactECharts className="budget-exec-chart" option={buildBudgetSourceExecutionOption(sourceRows)} notMerge lazyUpdate/></section><section className="budget-exec-card"><h2>预算执行率排行</h2><ReactECharts className="budget-exec-chart" option={buildBudgetExecutionRateOption(sourceRows)} notMerge lazyUpdate/></section></div><section className="budget-exec-card"><h2>预算池/需求方明细</h2><MiniTable rows={sourceRows.map(r => ({ ...r, demandCountLink: <button className="risk-id-link" onClick={()=>openDemandIds?.(r.demandIds || [], `预算池「${r.source}」关联需求`)}>{r.demandCount}</button>, budgetAmount: `${fmt(r.budgetAmount)}w`, totalExecutionCost: `${fmt(r.totalExecutionCost)}w`, remaining: `${fmt(r.remaining)}w`, executionRateText: Number.isFinite(r.executionRate) ? `${(r.executionRate*100).toFixed(1)}%` : '无预算', statusBadge: statusBadge(r.status) }))} cols={[["source","预算池/需求方"],["demandCountLink","需求数"],["budgetAmount","预算额度"],["totalExecutionCost","执行占用合计"],["remaining","剩余额度"],["executionRateText","执行率"],["noBudgetCount","无预算需求数"],["overBudgetDemandCount","单需求超预算数"],["statusBadge","状态"]]}/></section></section><section className="budget-exec-card"><h2>需求与预算池映射明细</h2><MiniTable rows={executionDemandRows.map(r => ({ ...r, demandLink: <button className="risk-id-link" onClick={()=>openDemand(r.id)}>{r.demandId}</button>, budgetAmount: `${fmt(r.budgetAmount)}w`, executionCost: `${fmt(r.executionCost)}w`, budgetInsufficientText: r.budgetInsufficient ? '是' : '否' }))} cols={[["demandLink","需求ID"],["title","名称"],["demandBA","需求BA"],["demandPM","需求PM"],["budgetSource","预算池/需求方"],["status","状态"],["executionStage","执行阶段"],["month","计划落地月份"],["executionDays","预算执行人天"],["budgetAmount","预算金额"],["executionCost","执行成本"],["budgetStatusLabel","预算状态"],["budgetInsufficientText","是否预算不足"]]}/></section></>}
  </div>;
}

function BudgetRiskDashboard({demands, budget, personnel = [], openDemand, openDemandIds}) {
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
  const rows = useMemo(() => buildBudgetRiskRows(monthFilteredDemands, budget, personnel), [monthFilteredDemands, budget, personnel]);
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
      <section className="risk-layer"><h2>整体风险</h2><div className="kpi-grid four"><Kpi label="高风险需求" value={`${summary.highRiskCount} 个`} tone={summary.highRiskCount>0?'danger':'ok'}/><Kpi label="中风险需求" value={`${summary.mediumRiskCount} 个`} tone={summary.mediumRiskCount>0?'danger':'ok'}/><Kpi label="风险人天" value={`${summary.gapDays} 人天`} tone={summary.gapDays>0?'danger':'ok'}/><Kpi label="预算金额缺口" value={`${summary.amountGap.toFixed(1)}w`} tone={summary.amountGap>0?'danger':'ok'} sub="已消耗 + 需求成本估算 - 全年预算"/></div><div className="kpi-grid four"><Kpi label="需求成本估算" value={`${summary.estimatedCost.toFixed(1)}w`} sub={`${getBudgetDayCost(budget)}w/人天`}/><Kpi label="历史/参考预算金额" value={`${summary.demandBudget.toFixed(1)}w`}/><Kpi label="工作量成本缺口" value={`${summary.budgetGap.toFixed(1)}w`} tone={summary.budgetGap>0?'danger':'ok'}/><Kpi label="需求总数" value={`${summary.totalCount} 个`}/></div><section className="risk-chart-card"><h2>整体预算缺口分析</h2><ReactECharts className="risk-chart" option={buildBudgetGapOption(rows, budget)} notMerge lazyUpdate/></section></section>
      <section className="risk-layer"><h2>风险分布</h2><div className="risk-chart-grid"><section className="risk-chart-card"><h2>风险等级分布</h2><ReactECharts className="risk-chart" option={buildRiskLevelOption(rows)} notMerge lazyUpdate/></section><section className="risk-chart-card"><h2>风险规则分类分布</h2><ReactECharts className="risk-chart" option={buildRiskCategoryOption(rows)} notMerge lazyUpdate/></section><section className="risk-chart-card"><h2>预算状态分布（需求数 vs 人力）</h2><ReactECharts className="risk-chart" option={buildBudgetDonutOption(rows)} notMerge lazyUpdate/></section><section className="risk-chart-card"><h2>月度风险趋势 / 按计划落地月份分布</h2><p className="muted">当前无历史快照，趋势按计划落地月份分布。</p><ReactECharts className="risk-chart" option={buildBudgetTrendOption(rows)} notMerge lazyUpdate/></section><section className="risk-chart-card"><h2>各状态人力投入与预算覆盖</h2><ReactECharts className="risk-chart" option={buildStatusBudgetOption(rows)} notMerge lazyUpdate/></section></div></section>
      <section className="risk-layer"><h2>风险明细</h2><section className="risk-table-card"><div className="toolbar"><h2>预算风险明细表</h2><div className="risk-filter-tags"><button className={riskLevelFilter==='nonLow'?'active':''} onClick={()=>keepScroll(()=>setRiskLevelFilter('nonLow'))}>中高风险</button><button className={riskLevelFilter==='high'?'active':''} onClick={()=>keepScroll(()=>setRiskLevelFilter('high'))}>高风险</button><button className={riskLevelFilter==='medium'?'active':''} onClick={()=>keepScroll(()=>setRiskLevelFilter('medium'))}>中风险</button><button className={riskLevelFilter==='low'?'active':''} onClick={()=>keepScroll(()=>setRiskLevelFilter('low'))}>低风险</button><button className={riskLevelFilter==='全部'?'active':''} onClick={()=>keepScroll(()=>setRiskLevelFilter('全部'))}>全部等级</button>{['全部', ...new Set(riskRules.map(rule => rule.category))].map(category => <button key={category} className={riskCategoryFilter===category?'active':''} onClick={()=>keepScroll(()=>setRiskCategoryFilter(category))}>{category}</button>)}</div></div><div className="mini-table risk-detail-table"><table><thead><tr><th>需求ID</th><th>名称</th><th>状态</th><th>计划落地</th><th>距落地天数</th><th>人力</th><th>预算来源</th><th>工作量成本</th><th>预算状态</th><th>预算池</th><th>预算池剩余</th><th>预算池状态</th><th>超额金额</th><th>人员工作量明细</th><th>风险等级</th><th>命中规则</th><th>建议操作</th></tr></thead><tbody>{riskDetailRows.map(row => <tr key={row.id} className={`risk-row-${row.riskLevel}`}><td><button className="risk-id-link" onClick={()=>openDemand(row.id)}>{row.demandNo || row.rr || row.id}</button></td><td>{row.title}</td><td>{row.status}</td><td>{row.landingDate || '未排期'}</td><td>{Number.isFinite(row.daysToLanding) ? row.daysToLanding : '未排期'}</td><td>{row.days}</td><td>{row.budgetSourceType === '其他' ? `其他-${row.budgetSource || '-'}` : row.budgetSourceType}</td><td>{fmt(row.workloadCost ?? row.budget)}w</td><td>{row.budgetStatusLabel}</td><td>{row.budgetPoolName}</td><td className={row.poolRemaining < 0 ? 'field-error' : ''}>{fmt(row.poolRemaining)}w</td><td>{statusBadge(row.poolStatus)}</td><td className={row.poolOverAmount > 0 ? 'field-error' : ''}>{fmt(row.poolOverAmount)}w</td><td className="risk-reason-cell">{row.missingPersonnelCost ? '未选择人员，预算占用未计算' : row.personnelWorkloadText}</td><td><span className={`risk-badge risk-${row.riskLevel}`}>{row.riskText}</span></td><td className="risk-reason-cell">{row.triggeredRules.map(rule => rule.name).join('；')}</td><td className="risk-reason-cell">{row.action}</td></tr>)}</tbody></table></div></section></section>
    </>}
  </div>;
}

function BudgetExecutionAnalysis({ demands, budget, personnel = [], openDemand, openDemandFilter }) {
  const safeDemands = Array.isArray(demands) ? demands : [];
  const [monthKey, setMonthKey] = useState(() => getCurrentMonthKey());
  const [refreshedAt, setRefreshedAt] = useState(() => new Date());
  const executorRows = useMemo(() => buildExecutorExecutionRows(safeDemands, budget, monthKey), [safeDemands, budget, monthKey]);
  const sourceRows = useMemo(() => buildBudgetSourceExecutionRows(safeDemands, budget, personnel), [safeDemands, budget, personnel]);
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
  return <><Header title="分析报告" desc="面向管理决策推演：基于不同新增预算场景，给出需求保留、延期和削减建议。实时风险监控请查看风险看板。"/><div className="kpi-grid four"><Kpi label="需求总量" value={`${totalDays} 人天`}/><Kpi label="无预算需求" value={`${unfunded} 人天`}/><Kpi label="预算换算口径" value={`${getBudgetDayCost(budget)}w/人天`}/><Kpi label="预算结余" value={`${budget.annualBudget-budget.consumedCost}w`} tone={budget.annualBudget-budget.consumedCost<0?'danger':'ok'}/></div><section className="card"><h2>人员管理</h2><p className="muted">人员管理按人员姓名、工号、负责人、岗位、地点、供应商、入项时间和元/人天成本维护。</p><MiniTable rows={personnel} cols={[['name','人员姓名'],['employeeNo','工号'],['owner','团队/负责人'],['position','岗位'],['location','地点'],['supplier','供应商'],['entryDate','入项时间'],['dailyCost','人天成本（元/人天）'],['monthlyDays','月度可用人天']]}/></section><section className="card"><h2>投入分布</h2><div className="three">{['investment','source'].map((f,i)=><div key={f}><h3>{['按需求方','按类型'][i]}</h3>{groupSum(demands,f).map(([k,v])=><div className="bar" key={k}><span>{k}</span><b>{v}</b></div>)}</div>)}</div></section>{results.map(r=><section className="card scenario-detail" key={r.name}><h2>{r.name}</h2><div className="kpi-grid four"><Kpi label="新增预算" value={`${r.addedBudget}w`}/><Kpi label="抵扣后可用" value={`${r.nextMonthBudget.toFixed(1)}w`}/><Kpi label="可支撑" value={`${r.supportedDays.toFixed(1)} 人天`}/><Kpi label="需减少/延后" value={`${r.reductionNeeded.toFixed(1)} 人天`} tone={r.reductionNeeded>0?'danger':'ok'}/></div><div className="reason"><b>推理原因</b><ol><li>当前预算结余为 {(budget.annualBudget-budget.consumedCost).toFixed(1)}w，新增预算 {r.addedBudget}w 后，抵扣历史超支得到本场景可用预算。</li><li>系统按后台人员人天成本口径换算预算可支撑的人天。</li><li>下月需求总量为 {r.totalDays} 人天，本场景需减少或延后 {r.reductionNeeded.toFixed(1)} 人天。</li><li>优先保留紧急/高优先级、重要用户、有预算状态、已承诺未获取、合规监管类需求。</li></ol></div><Decision title="建议保留" rows={r.retained}/><Decision title="建议延期" rows={r.deferred}/><Decision title="建议削减" rows={r.cut}/></section>)}</>;
}

function Decision({title, rows}) { return <div className="decision"><h3>{title}</h3>{rows.length===0?<p className="empty">无</p>:<MiniTable rows={rows.map(row => ({ ...row, budgetStatusText: row.budgetStatus }))} cols={[[ 'title','需求'],['priority','优先级'],['landingDate','计划落地日期'],['days','人天'],['budgetStatusText','预算状态'],['score','评分'],['reason','原因']]}/>}</div>; }

function WorkCalendarPage({ personnel = [], demands = [], purchaseOrders = [], setPurchaseOrders, onOpenPurchaseOrders }) {
  const [startDate, setStartDate] = useState(getCurrentDateKey);
  const [endDate, setEndDate] = useState(() => getDateKeyAfterDays(30));
  const [issueOpen, setIssueOpen] = useState(false);
  const [supplier, setSupplier] = useState('');
  const [typeFilter, setTypeFilter] = useState('全部');
  const [selectedIds, setSelectedIds] = useState([]);
  const [manDays, setManDays] = useState({});
  const [note, setNote] = useState('');
  const result = useMemo(() => calculateWorkCalendarRange(startDate, endDate), [startDate, endDate]);
  const rows = result.details?.map(item => ({ date: item.date, typeText: workCalendarTypeLabels[item.type], effectiveText: <span className={item.effective ? 'work-calendar-effective' : 'work-calendar-invalid'}>{item.effective ? '是' : '否'}</span>, note: item.note || '-' })) || [];
  const poPeriod = startDate ? String(startDate).slice(0, 7) : getCurrentMonthKey();
  const normalizedPersonnel = personnel.map(normalizePersonnel);
  const availablePeople = normalizedPersonnel.filter(p => supplier && p.supplier === supplier && poPersonnelTypeOptions.includes(p.personnelType) && toNumber(p.dailyCost) > 0 && (typeFilter === '全部' || p.personnelType === typeFilter));
  const selectedSet = new Set(selectedIds.map(String));
  const selectedPeople = normalizedPersonnel.filter(p => selectedSet.has(String(p.id)));
  const groups = buildPoIssueGroups({ personnel: normalizedPersonnel, selectedIds, manDayOverrides: manDays, effectiveWorkdays: result.effectiveDays || 0 });
  const fmt = value => Number(value || 0).toFixed(1);
  const togglePerson = id => setSelectedIds(ids => ids.map(String).includes(String(id)) ? ids.filter(item => String(item) !== String(id)) : [...ids, String(id)]);
  const selectAll = () => { setSelectedIds(availablePeople.map(p => String(p.id))); setManDays(current => Object.fromEntries(availablePeople.map(p => [String(p.id), current[String(p.id)] ?? result.effectiveDays]))); };
  const clearSelection = () => setSelectedIds([]);
  const openIssue = () => { setIssueOpen(true); setSupplier(''); setSelectedIds([]); setManDays({}); setNote(''); };
  const createOrders = () => {
    if (result.error) { alert(result.error); return; }
    if (!supplier) { alert('请选择供应商'); return; }
    if (!selectedIds.length) { alert('请至少选择 1 名人员'); return; }
    const invalid = selectedPeople.find(p => p.supplier !== supplier || !poPersonnelTypeOptions.includes(p.personnelType) || toNumber(p.dailyCost) <= 0 || toNumber(manDays[String(p.id)] ?? result.effectiveDays) <= 0);
    if (invalid) { alert(`人员 ${invalid.name || invalid.employeeNo} 不满足 PO 下发条件`); return; }
    const nextGroups = buildPoIssueGroups({ personnel: normalizedPersonnel, selectedIds, manDayOverrides: manDays, effectiveWorkdays: result.effectiveDays });
    if (!nextGroups.length) { alert('没有可创建的 PO 分组'); return; }
    const createdAt = new Date().toISOString();
    const created = nextGroups.map((group, idx) => {
      const ids = group.people.map(p => String(p.id));
      return normalizePurchaseOrder({
        id: `po-${Date.now()}-${idx}`,
        poNo: makePurchaseOrderNo(purchaseOrders, idx),
        createdAt,
        supplier,
        personnelType: group.personnelType,
        startDate,
        endDate,
        poPeriod,
        effectiveWorkdays: result.effectiveDays,
        totalManDays: group.totalManDays,
        estimatedTotalCost: group.estimatedTotalCost,
        selectedPersonnelIds: ids,
        personnelSnapshot: group.people.map(p => ({ id: p.id, name: p.name, employeeNo: p.employeeNo, owner: p.owner, position: p.position, supplier: p.supplier, personnelType: p.personnelType, dailyCost: p.dailyCost, manDays: p.manDays, cost: p.cost })),
        demandLinks: buildPurchaseOrderDemandLinks(demands, ids, poPeriod, normalizedPersonnel),
        note
      }, idx);
    });
    setPurchaseOrders?.(orders => [...orders, ...created]);
    setIssueOpen(false);
    alert(`已创建 ${created.length} 条 PO 记录（TM/OD 分别统计）`);
  };
  return <>
    <Header title="人力日历" desc="选择任意日期范围，统计有效工作日，并按供应商和人员类型下发 PO。"/>
    <section className="card work-calendar-range-card"><div className="toolbar"><div className="form small work-calendar-range-form"><label>开始日期<input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></label><label>结束日期<input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}/></label></div><div className="actions"><button onClick={openIssue} disabled={Boolean(result.error)}>下发PO</button></div></div></section>
    {result.error ? <p className="finance-note">{result.error}</p> : <><div className="kpi-grid four"><Kpi label="总自然日" value={`${result.totalDays} 天`}/><Kpi label="有效工作日" value={`${result.effectiveDays} 天`} tone="ok"/><Kpi label="周末" value={`${result.weekendDays} 天`} tone={result.weekendDays ? 'danger' : 'ok'}/><Kpi label="法定节假日" value={`${result.holidayDays} 天`} tone={result.holidayDays ? 'danger' : 'ok'}/></div>{result.unconfiguredYears.length > 0 && <p className="finance-note">{result.unconfiguredYears.join('、')} 年未配置法定节假日，仅按周末规则估算。</p>}<section className="card"><h2>日期明细</h2><div className="work-calendar-detail-table"><MiniTable rows={rows} cols={[[ 'date','日期'],['typeText','类型'],['effectiveText','是否有效工作日'],['note','说明']]}/></div></section></>}
    {issueOpen && <div className="modal-backdrop"><div className="modal-card po-issue-modal"><div className="modal-header"><h2>下发PO</h2><button className="secondary" onClick={()=>setIssueOpen(false)}>关闭</button></div><div className="form small"><label>开始日期<input value={startDate} disabled/></label><label>结束日期<input value={endDate} disabled/></label><label>有效工作日<input value={result.effectiveDays || 0} disabled/></label><label><span className="required-label">供应商</span><select value={supplier} onChange={e=>{ setSupplier(e.target.value); setSelectedIds([]); }}><option value="">请选择</option>{supplierOptions.map(item => <option key={item}>{item}</option>)}</select></label><label>人员类型筛选<select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option>全部</option>{poPersonnelTypeOptions.map(item => <option key={item}>{item}</option>)}</select></label><label>备注<input value={note} onChange={e=>setNote(e.target.value)} placeholder="可选"/></label></div><div className="toolbar"><div className="actions"><button onClick={selectAll} disabled={!supplier}>全选当前供应商人员</button><button onClick={clearSelection}>清空选择</button></div><div className="actions"><button onClick={onOpenPurchaseOrders}>查看PO管理</button></div></div><div className="po-summary-grid">{poPersonnelTypeOptions.map(type => { const g = groups.find(item => item.personnelType === type) || { people: [], totalManDays: 0, estimatedTotalCost: 0 }; return <div className="po-type-summary" key={type}><b>{type}</b><span>{g.people.length} 人 / {fmt(g.totalManDays)} 人天 / {fmt(g.estimatedTotalCost)}w</span></div>; })}<div className="po-type-summary"><b>合计</b><span>{selectedIds.length} 人 / {fmt(groups.reduce((s,g)=>s+g.totalManDays,0))} 人天 / {fmt(groups.reduce((s,g)=>s+g.estimatedTotalCost,0))}w</span></div></div><div className="mini-table po-selection-table"><table><thead><tr><th>选择</th><th>姓名</th><th>工号</th><th>团队</th><th>岗位</th><th>供应商</th><th>人员类型</th><th>人天成本</th><th>本次PO人天</th><th>费用</th></tr></thead><tbody>{availablePeople.length ? availablePeople.map(p => { const days = toNumber(manDays[String(p.id)] ?? result.effectiveDays); return <tr key={p.id}><td><input type="checkbox" checked={selectedSet.has(String(p.id))} onChange={()=>togglePerson(p.id)}/></td><td>{p.name}</td><td>{p.employeeNo}</td><td>{p.owner || '-'}</td><td>{p.position}</td><td>{p.supplier}</td><td>{p.personnelType}</td><td>{p.dailyCost}</td><td><input type="number" min="0" value={days} onChange={e=>setManDays(current=>({...current,[String(p.id)]:Number(e.target.value)}))}/></td><td>{fmt(days * toNumber(p.dailyCost) / 10000)}w</td></tr>; }) : <tr><td colSpan="10">请选择供应商；仅展示供应商匹配、TM/OD 且人天成本大于 0 的人员。若无可选人员，请检查人员基础信息中的供应商、人员类型、人天成本。</td></tr>}</tbody></table></div><div className="modal-actions"><button className="secondary" onClick={()=>setIssueOpen(false)}>取消</button><button className="primary inline" onClick={createOrders}>创建PO</button></div></div></div>}
  </>;
}

function MiniTable({rows, cols}) {
  const [sort, setSort] = useState({ key: '', direction: 'asc' });
  const sortedRows = useMemo(() => sortRows(rows, sort), [rows, sort]);
  return <div className="mini-table"><table><thead><tr>{cols.map(c=><th key={c[0]}><button className="table-sort-trigger" onClick={()=>setSort(current=>toggleSort(current, c[0]))}>{c[1]}<span className="sort-indicator">{sort.key === c[0] ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span></button></th>)}</tr></thead><tbody>{sortedRows.length ? sortedRows.map((r,i)=><tr key={i}>{cols.map(c=><td key={c[0]}>{typeof r[c[0]]==='boolean' ? (r[c[0]]?'是':'否') : r[c[0]]}</td>)}</tr>) : <tr><td colSpan={cols.length}>暂无数据</td></tr>}</tbody></table></div>;
}

function Manual() { return <><Header title="Web版操作说明手册" desc="普通用户可按本手册了解每个功能的用途和操作步骤。"/><section className="manual card"><h2>推荐操作流程</h2><div className="workflow-diagram"><div className="workflow-node"><b>特性管理</b><span>维护 L1-L7 层级和别名</span></div><div className="workflow-arrow">↓</div><div className="workflow-node"><b>集成点管理</b><span>维护RR评估使用的产品/子产品/IT产品服务/模块目录</span></div><div className="workflow-arrow">↓</div><div className="workflow-node"><b>人员管理</b><span>维护成员、类型、供应商、人天成本</span></div><div className="workflow-arrow">↓</div><div className="workflow-node"><b>预算管理</b><span>维护预算池、金额、来源和负责人</span></div><div className="workflow-arrow">↓</div><div className="workflow-node"><b>需求管理</b><span>提交/导入需求，填写需求方、预算来源、计划落地、PO期间、人天和人员工作量</span></div><div className="workflow-arrow">↓ ↘</div><div className="workflow-node"><b>人力日历下发 PO → PO管理</b><span>按供应商、人员类型、人员、人天沉淀 PO</span></div><div className="workflow-arrow">↓ ↘</div><div className="workflow-node"><b>预算与风险分析</b><span>汇总预算占用、PO成本、结算成本与差异</span></div></div><h3>输入什么影响什么</h3><div className="workflow-note-grid"><div><b>特性管理</b><p>L1-L7 和别名用于IR关联特性；IR特性工作量会汇总为RR工作量，并参与后续预算/PO相关计算。</p></div><div><b>集成点管理</b><p>产品、子产品必填，IT产品服务和模块选填；RR分析阶段可按集成点填写接口内容和分摊工作量，并计入RR总工作量。</p></div><div><b>人员管理</b><p>人员类型、供应商、人天成本影响下发 PO 的可选人员、PO 成本、需求人员工作量成本。</p></div><div><b>预算管理</b><p>预算池金额、所属需求方/部门、预算来源影响需求成本扣减、预算剩余、超额判断。</p></div><div><b>需求管理</b><p>新建需求默认分析中；RR基础工作量和集成点分摊工作量共同构成RR总工作量；预算占用仍依赖人员工作量明细。</p></div><div><b>PO 管理</b><p>PO 记录由人力日历下发生成，影响已创建 PO 成本、预算-PO差异、PO-结算差异。</p></div></div><h2>1. 特性管理</h2><p>用途：维护 L1-L7 特性层级定义、层级别名和特性清单。</p><ol><li>先维护 L1-L7 层级别名，统一项目沟通和分类口径。</li><li>再点击“新增特性”逐行维护，或下载模板后批量导入特性清单。</li><li>通过“启用/停用”维护当前有效范围。</li><li>需要线下盘点时点击“导出”下载 CSV。</li></ol><h2>2. 集成点管理</h2><p>用途：维护RR集成点工作量评估可选择的产品、子产品和模块目录。</p><ol><li>产品和子产品必填，模块可选。</li><li>同一产品、子产品、IT产品服务、模块组合不可重复。</li><li>停用的集成点不会出现在新增RR集成点工作量的选择列表中，历史RR快照仍可查看。</li></ol><h2>3. 需求管理</h2><p>用途：集中管理所有需求提交方提供的需求清单，支持提交、筛选、字段编辑、导入和导出。</p><ol><li>进入系统后默认打开需求管理。</li><li>查看顶部指标卡，了解需求总数、总预估人天、有预算需求数和数据缺失数量。</li><li>使用全文检索、月份范围和表头筛选定位需求；所有需求池表头都可点击排序，排序在筛选后生效。</li><li>点击“提交需求”录入新需求；点击需求名称可打开详情并保存修改。</li><li>导入时，系统会先按字段名推荐映射关系，可自行修正后再导入。</li></ol><h2>4. 人员管理</h2><p>用途：维护可参与需求和 PO 下发的人员基础信息。</p><ol><li>点击“人员管理”后默认进入“人员基础信息”，可直接维护人员或导入人员清单。</li><li>人员字段包含人员类型、供应商、人天成本等；供应商仅支持赛意、软通，人员类型支持 OD、TM、其他。</li><li>点击“下载模板”获取人员导入模板，点击“导入”批量导入 CSV；重复工号会被跳过并提示。</li><li>PO 下发需要人员类型为 TM/OD、供应商为赛意/软通且人天成本大于 0。</li></ol><h2>5. 预算管理</h2><p>用途：维护预算池、金额、来源、负责人等预算基础信息。</p><ol><li>点击“预算管理”维护需求方预算、部门基线预算和其他预算来源。</li><li>预算池金额会用于需求成本扣减、预算剩余和超额判断。</li><li>预算来源和需求方需要与需求管理中的字段保持一致，才能自动匹配。</li></ol><h2>6. 人力日历与 PO 下发</h2><p>用途：选择日期范围后统计有效工作日，并按供应商生成 PO。</p><ol><li>点击“人力日历”，选择开始日期和结束日期。</li><li>确认有效工作日后点击“下发PO”。</li><li>选择供应商、人员类型和人员清单，可全选或部分选择，并可调整每个人本次 PO 人天。</li><li>如同时选择 TM 和 OD，系统会自动拆分为两条 PO 记录分别统计。</li></ol><h2>7. PO管理</h2><p>用途：沉淀从人力日历下发的 PO 记录。</p><ol><li>点击“PO管理”查看 PO 数、人天、成本以及 TM/OD 汇总。</li><li>可按供应商、人员类型、月份和关键词筛选。</li><li>PO 记录可展开查看人员快照和关联需求快照，也可导出 CSV 或删除记录。</li></ol><h2>8. 预算与风险分析</h2><p>用途：统一查看预算、需求、PO 与结算之间的差异。</p><ol><li>页面包含“预算池总览、月度预算占用、需求占用明细、预算-PO-结算、风险分析、执行分析”等页签。</li><li>预算池总览会展示已创建 PO 成本、预算-PO差异、PO-结算差异、TM PO成本和 OD PO成本。</li><li>“预算-PO-结算”页签展示预算池总额、需求执行估算成本、已创建 PO 成本、结算成本，以及预算-PO、需求估算-PO、PO-结算差异。</li><li>修改需求结算人力或新增/删除 PO 后，相关 KPI 和差异会自动刷新。</li></ol></section></>; }

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

const featureImportFields = [
  ['code', '特性编码', ['特性编码', '编码', 'featureCode', 'code']],
  ...featureLevelKeys.map(key => [key, key.toUpperCase(), [key.toUpperCase(), key, `特性${key.toUpperCase()}`, `层级${key.toUpperCase()}`]]),
  ['owner', '负责人', ['负责人', 'owner']],
  ['status', '状态', ['状态', 'status']],
  ['description', '描述', ['描述', '说明', 'description']]
];

function getFeatureImportLabel(features, key, label) {
  return featureLevelKeys.includes(key) ? getFeatureLevelLabel(features, key) : label;
}

function guessFeatureImportMapping(headers, features) {
  const used = new Set();
  const mapping = {};
  featureImportFields.forEach(([key, label, aliases]) => {
    const candidates = [...aliases, label, featureLevelKeys.includes(key) ? getFeatureLevelLabel(features, key) : ''].filter(Boolean);
    const match = candidates.find(candidate => headers.includes(candidate));
    if (match && !used.has(headers.indexOf(match))) { mapping[key] = match; used.add(headers.indexOf(match)); }
    else mapping[key] = '';
  });
  return mapping;
}

function parseFeatureCsv(text, fieldMapping = {}, features = createDefaultFeatureManagement()) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('CSV至少需要表头和一行数据');
  const headers = rows[0].map(h => h.trim());
  const get = (record, key) => {
    const mapped = fieldMapping[key];
    const [, label, aliases] = featureImportFields.find(field => field[0] === key) || [];
    const names = mapped ? [mapped] : [...(aliases || []), label, featureLevelKeys.includes(key) ? getFeatureLevelLabel(features, key) : ''].filter(Boolean);
    for (const name of names) {
      const idx = headers.indexOf(name);
      if (idx >= 0 && record[idx] !== undefined && String(record[idx]).trim() !== '') return String(record[idx]).trim();
    }
    return '';
  };
  return rows.slice(1).map((record, idx) => normalizeFeatureRow({
    code: get(record, 'code'),
    ...Object.fromEntries(featureLevelKeys.map(key => [key, get(record, key)])),
    owner: get(record, 'owner'),
    status: featureStatusOptions.includes(get(record, 'status')) ? get(record, 'status') : '启用',
    description: get(record, 'description')
  }, idx)).filter(row => row.code || featureLevelKeys.some(key => row[key]));
}

function featureCsvLine(values) {
  return values.map(v => `"${String(v ?? '').replaceAll('"','""')}"`).join(',');
}

function downloadFeatureCsv(features) {
  const headers = ['特性编码', ...featureLevelKeys.map(key => getFeatureLevelLabel(features, key)), '负责人', '状态', '描述'];
  const lines = [headers.join(',')].concat(features.rows.map(row => featureCsvLine([row.code, ...featureLevelKeys.map(key => row[key]), row.owner, row.status, row.description])));
  const blob = new Blob(['\ufeff' + lines.join('\n')], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'features.csv'; a.click();
}

function downloadFeatureTemplate(features) {
  const headers = ['特性编码', ...featureLevelKeys.map(key => getFeatureLevelLabel(features, key)), '负责人', '状态', '描述'];
  const sample = ['F001', '业务域', '产品线', '模块', '能力', '子能力', '功能点', '页面/接口', '张三', '启用', '示例特性描述'];
  const blob = new Blob(['\ufeff' + [headers.join(','), featureCsvLine(sample)].join('\n')], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'feature-import-template.csv'; a.click();
}


const integrationPointImportFields = [
  ['product', '产品', ['产品', 'product']],
  ['subProduct', '子产品', ['子产品', '子产品线', 'subProduct']],
  ['itService', 'IT产品服务', ['IT产品服务', 'IT产品/服务', 'IT服务', 'itService']],
  ['module', '模块', ['模块', 'module']],
  ['description', '描述', ['描述', '说明', 'description']]
];
function guessIntegrationPointImportMapping(headers) {
  const used = new Set();
  const mapping = {};
  integrationPointImportFields.forEach(([key, label, aliases]) => {
    const match = [...aliases, label].find(alias => headers.includes(alias));
    if (match && !used.has(headers.indexOf(match))) { mapping[key] = match; used.add(headers.indexOf(match)); }
    else mapping[key] = '';
  });
  return mapping;
}
function parseIntegrationPointCsv(text, fieldMapping = {}) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('CSV至少需要表头和一行数据');
  const headers = rows[0].map(h => h.trim());
  const get = (record, key) => {
    const mapped = fieldMapping[key];
    const [, label, aliases] = integrationPointImportFields.find(field => field[0] === key) || [];
    const names = mapped ? [mapped] : [...(aliases || []), label].filter(Boolean);
    for (const name of names) {
      const idx = headers.indexOf(name);
      if (idx >= 0 && record[idx] !== undefined && String(record[idx]).trim() !== '') return String(record[idx]).trim();
    }
    return '';
  };
  return rows.slice(1).filter(row => row.some(cell => String(cell ?? '').trim() !== '')).map((record, idx) => normalizeIntegrationPointRow({
    product: get(record, 'product'), subProduct: get(record, 'subProduct'), itService: get(record, 'itService'), module: get(record, 'module'), description: get(record, 'description')
  }, idx)).filter((row, idx) => {
    if (!row.product || !row.subProduct) throw new Error(`第${idx + 2}行产品和子产品必填`);
    return true;
  });
}
function downloadIntegrationPointCsv(catalog) {
  const headers = integrationPointImportFields.map(([, label]) => label);
  const lines = [headers.join(',')].concat((catalog.rows || []).map(row => featureCsvLine([row.product, row.subProduct, row.itService, row.module, row.description])));
  const blob = new Blob(['\ufeff' + lines.join('\n')], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'integration-points.csv'; a.click();
}
function downloadIntegrationPointTemplate() {
  const headers = integrationPointImportFields.map(([, label]) => label);
  const rows = [
    ['产品A','子产品A1','服务X','模块X','包含模块的集成点示例'],
    ['产品B','子产品B1','服务Y','','产品/子产品/IT产品服务级集成点示例']
  ];
  const blob = new Blob(['\ufeff' + [headers.join(','), ...rows.map(featureCsvLine)].join('\n')], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'integration-point-import-template.csv'; a.click();
}

const requiredDemandImportFields = new Set(['title', 'source', 'investment', 'requester', 'priority', 'landingDate', 'workloadMode', 'days']);
const demandImportFields = [
  ['demandKind', '需求层级', ['需求层级', '层级', '需求类型', 'RR/IR']], ['title', '需求名称', ['需求名称', '需求', '标题', '需求标题']], ['demandNo', '需求单号', ['需求单号', '需求编号', 'RR单号', 'RR']], ['source', '类型', ['类型', '需求来源']], ['investment', '需求方', ['需求方', '投资来源']], ['budgetSourceType', '预算来源', ['预算来源', '预算来源类型']], ['budgetSource', '其他预算来源', ['其他预算来源', '预算来源明细']], ['budgetPoolId', '预算池ID', ['预算池ID']], ['demandBA', '需求BA', ['需求BA', 'BA', '业务分析师', '需求分析师']], ['demandPM', '需求PM', ['需求PM', 'PM', '项目经理', '交付PM', '需求PM', '负责人', '开发负责人', '承接人']], ['pain', '当前业务痛点', ['当前业务痛点', '业务痛点']], ['goal', '需求目标', ['需求目标']], ['value', '需求价值', ['需求价值']], ['acceptanceCriteria', '验收标准', ['验收标准', '验收条件', '验收准则', '验收口径', 'AC']], ['requester', '需求提出人', ['需求提出人', '提出人', '申请人']], ['review', '业务评审结论', ['业务评审结论', '评审结论']], ['status', '需求状态', ['需求状态', '进展状态']], ['parentRrNo', '关联RR单号', ['关联RR单号', '父RR单号', '关联RR']], ['irNo', 'IR单号', ['IR单号']], ['featureCode', '特性编码', ['特性编码', '关联特性编码']], ['featureWorkload', '特性工作量', ['特性工作量', '特性预计工作量']], ['analysisStage', '分析阶段', ['分析阶段']], ['analysisConclusion', '分析结论', ['分析结论']], ['ir', '旧IR单号', ['旧IR单号']], ['priority', '优先级', ['优先级']], ['version', '版本', ['版本']], ['landingDate', '计划落地日期', ['计划落地日期', '计划上线日期', '计划完成日期', '落地日期']], ['poPeriod', 'PO执行期间', ['poPeriod', 'PO执行期间', 'PO期间', 'PO月份', '执行期间']], ['workloadMode', '工作量填写方式', ['工作量填写方式', '填写方式']], ['baseWorkloadDays', '基础工作量', ['基础工作量', 'RR基础工作量']], ['integrationPointWorkload', '集成点工作量', ['集成点工作量']], ['integrationPointSummary', '集成点明细', ['集成点明细']], ['days', '总工作量', ['总工作量', '总工作量（人天）预估', '总工作量人天', '预估人天']], ['analysis', '需求分析工作量预估', ['需求分析工作量预估', '分析']], ['frontend', '前端开发工作量预估', ['前端开发工作量预估', '前端']], ['middle', '中台开发工作量预估', ['中台开发工作量预估', '中台']], ['backend', '后台开发工作量预估', ['后台开发工作量预估', '后台']], ['finalDays', '决算人力', ['决算人力', '决算人天', '最终调整人力', '最终调整人天', '最终人力', '调整后人天']], ['settlementDays', '结算人力', ['结算人力', '结算人力资源投入', '实际结算人天']], ['funded', '是否带预算', ['是否带预算', '是否有预算']], ['budget', '历史/参考预算金额w', ['历史/参考预算金额w', '预算金额']], ['budgetContact', '预算接口人', ['预算接口人']], ['budgetEta', '预算承诺日期', ['预算承诺日期', '预计获取时间']], ['budgetAcquiredDate', '预算获取日期', ['预算获取日期', 'SMP预算获取日期', '预算获取日期（SMP系统）']], ['budgetStatus', '预算状态', ['预算状态']], ['committed', '是否承诺', ['是否承诺', '是否已承诺']]
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
    if (demandNo && !isValidRr(demandNo)) throw new Error(`第${idx + 2}行需求单号无效：${demandNo}。${rrFormatText}`);
    return {
    demandKind: String(getField(record, 'demandKind', '')).toUpperCase() === 'IR' || getField(record, 'demandKind', '') === 'IR' || getField(record, 'demandKind', '') === '需求IR' ? 'IR' : 'RR',
    title: getField(record, 'title', `导入需求${idx + 1}`),
    demandNo,
    source: getField(record, 'source', '产品立项规划'),
    investment: getField(record, 'investment', baselineDemandParty),
    budgetSourceType: getField(record, 'budgetSourceType', '部门基线'),
    budgetSource: getField(record, 'budgetSource', ''),
    budgetPoolId: getField(record, 'budgetPoolId', ''),
    demandBA: getField(record, 'demandBA', ''),
    demandPM: getField(record, 'demandPM', ''),
    pain: getField(record, 'pain', ''),
    goal: getField(record, 'goal', ''),
    value: getField(record, 'value', ''),
    acceptanceCriteria: getField(record, 'acceptanceCriteria', ''),
    requester: getField(record, 'requester', ''),
    review: getField(record, 'review', '待评审'),
    status: getField(record, 'status', '分析中'),
    rr: demandNo,
    parentRrNo: formatRr(getField(record, 'parentRrNo', '')),
    irNo: formatIr(getField(record, 'irNo', '') || getField(record, 'ir', '')),
    ir: formatIr(getField(record, 'irNo', '') || getField(record, 'ir', '')),
    featureCode: getField(record, 'featureCode', ''),
    featureWorkload: num(getField(record, 'featureWorkload', '0')),
    analysisStage: getField(record, 'analysisStage', '分析中'),
    analysisConclusion: getField(record, 'analysisConclusion', ''),
    priority: getField(record, 'priority', '高'),
    version: getField(record, 'version', ''),
    landingDate: getField(record, 'landingDate', ''),
    poPeriod: getField(record, 'poPeriod', '') || (getField(record, 'landingDate', '') ? String(getField(record, 'landingDate', '')).slice(0, 7) : ''),
    workloadMode: getField(record, 'workloadMode', '').includes('分项') || getField(record, 'workloadMode', '') === 'breakdown' ? 'breakdown' : 'total',
    baseWorkloadDays: num(getField(record, 'baseWorkloadDays', getField(record, 'days', '0'))),
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
  }).filter(d => d.title && (isIrDemand(d) || toNumber(d.days) > 0 || toNumber(d.finalDays) > 0 || toNumber(d.analysis) + toNumber(d.frontend) + toNumber(d.middle) + toNumber(d.backend) > 0));
}

function resolveImportedDemandAssociations(imported, existingDemands = [], features = createDefaultFeatureManagement()) {
  const rrByNo = new Map([...existingDemands, ...imported].filter(isRrDemand).map(d => [formatRr(d.demandNo || d.rr), d]));
  return imported.map((d, idx) => {
    const next = { ...d };
    if (isIrDemand(next)) {
      if (!next.parentRrNo) throw new Error(`第${idx + 2}行IR缺少关联RR单号`);
      if (!next.irNo) throw new Error(`第${idx + 2}行IR缺少IR单号`);
      if (!isValidIr(next.irNo)) throw new Error(`第${idx + 2}行IR单号无效：${next.irNo}。${irFormatText}`);
      const parent = rrByNo.get(formatRr(next.parentRrNo));
      if (!parent) throw new Error(`第${idx + 2}行关联RR不存在：${next.parentRrNo}`);
      const feature = findFeature(features, '', next.featureCode);
      if (!feature) throw new Error(`第${idx + 2}行特性编码不存在：${next.featureCode || '空'}`);
      if (toNumber(next.featureWorkload) <= 0) throw new Error(`第${idx + 2}行特性工作量必须大于0`);
      next.parentRrId = parent.id || `import-rr-${formatRr(parent.demandNo || parent.rr)}`;
      next.parentRrNo = formatRr(parent.demandNo || parent.rr);
      next.featureId = feature.id;
      next.featureCode = feature.code;
      next.days = toNumber(next.featureWorkload);
    }
    return next;
  });
}

function downloadTemplate() {
  const headers = demandImportFields.map(([, label]) => label);
  const rrSample = ['RR','示例RR','RR2026053012345','产品立项规划',baselineDemandParty,'部门基线','','','李BA','王PM','当前流程效率低','优化处理流程','提升效率','上线后核心流程可验证且异常可回滚','张三','待评审','待评估','','','','分析完成','已拆解为核心特性IR','','高','','2026-08-31','2026-08','total','30','5','10','8','7','0','0','否','0','','','','已承诺未获取','是'];
  const irSample = ['IR','示例IR','', '产品立项规划',baselineDemandParty,'部门基线','','','李BA','王PM','继承RR业务背景','完成特性落地','支撑RR价值','按IR验收','张三','待评审','待评估','RR2026053012345','IR2026053012345','F001','12','','','IR2026053012345','高','','2026-08-31','2026-08','total','12','0','0','0','0','0','0','否','0','','','','已承诺未获取','是'];
  const csv = [headers.join(','), rrSample.map(v => `"${v}"`).join(','), irSample.map(v => `"${v}"`).join(',')].join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '需求导入模板.csv'; a.click();
}

function downloadImportTestCsv() {
  const headers = ['需求PM','需求编号','需求标题','预算来源','申请人','落地日期','PO执行期间','填写方式','预估人天','分析','前端','中台','后台','决算人力','预算金额','SMP预算获取日期','进展状态','预算状态','优先级'];
  const rows = [
    ['王开发','RR2026061401001','测试导入-分项工作量','财经','财经-张三','2026-06-30','2026-06','按分项','','4','8','6','7','28','12','2026-06-10','开发中','已获取','紧急'],
    ['李开发','RR2026061401002','测试导入-字段顺序不同','制造','制造-李四','2026-07-15','2026-07','按总量','35','','','','','0','8','','已排期','已承诺未获取','高'],
    ['赵开发','RR2026061401003','测试导入-无预算后续需求','采购','采购-王五','2026-08-20','2026-08','按总量','22','','','','','0','0','','待评估','无预算','一般'],
    ['钱开发','RR2026061401004','测试导入-已验收结算','审计','审计-赵六','2026-06-28','2026-06','按总量','18','','','','','0','20','2026-06-12','已验收','已获取','高'],
    ['孙开发','RR2026061401005','测试导入-最终人力优先','供应','供应-孙七','2026-07-31','2026-07','按总量','40','','','','','32','16','2026-06-18','已上线','已获取','紧急']
  ];
  const csv = [headers.join(','), ...rows.map(row => row.map(v => `"${v}"`).join(','))].join('\n');
  const blob = new Blob(['\ufeff' + csv], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '需求导入映射测试表.csv'; a.click();
}

function downloadCsv(demands) {
  const headers = ['需求层级','需求名称','需求单号','关联RR单号','IR单号','特性编码','特性工作量','分析阶段','分析结论','类型','需求方','预算来源','其他预算来源','预算池ID','需求BA','需求PM','验收标准','优先级','版本','计划落地日期','PO执行期间','工作量填写方式','基础工作量','集成点工作量','集成点明细','总工作量','决算人力','结算人力','历史/参考预算金额w','预算接口人','预算承诺日期','预算获取日期','预算状态','评审结论','需求状态'];
  const lines = [headers.join(',')].concat(demands.map(d => [getDemandKind(d),d.title,d.demandNo,d.parentRrNo || '',d.irNo || d.ir || '',d.featureCode || '',isIrDemand(d) ? getIrWorkload(d) : '',d.analysisStage || '',d.analysisConclusion || '',d.source,d.investment,d.budgetSourceType || '部门基线',d.budgetSourceType === '其他' ? (d.budgetSource || '') : '',d.budgetPoolId || '',d.demandBA || '',d.demandPM || '',d.acceptanceCriteria || '',d.priority,d.version,d.landingDate || '',getDemandPoPeriod(d),d.workloadMode || 'total',isRrDemand(d) ? getRrBaseWorkloadDays(d) : '',isRrDemand(d) ? getIntegrationPointWorkloadDays(d) : '',isRrDemand(d) ? formatIntegrationPointWorkloads(d) : '',getDemandDisplayDays(d, demands),toNumber(d.finalDays),toNumber(d.settlementDays),d.budget,d.budgetContact || '',d.budgetEta || '',d.budgetAcquiredDate || '',d.budgetStatus || '无预算',d.review,d.status].map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')));
  const blob = new Blob([lines.join('\n')], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'demands.csv'; a.click();
}

createRoot(document.getElementById('root')).render(<App/>);
