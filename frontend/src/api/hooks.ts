import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import { api } from "./client";
import type {
  ActivityOut,
  CompanyOut,
  ContactOut,
  DashboardSummary,
  DealOut,
  DealStage,
  TaskOut,
  TaskStatus,
  UserOut,
} from "./types";

/*
 * Query keys are hierarchical so a broad prefix invalidates everything beneath
 * it: invalidating ["deals"] catches the board, every filtered list and every
 * single-deal query in one call.
 */
export const queryKeys = {
  me: ["auth", "me"] as const,

  dashboard: ["dashboard"] as const,
  dashboardSummary: ["dashboard", "summary"] as const,

  deals: ["deals"] as const,
  dealBoard: ["deals", "board"] as const,
  dealList: (filters: Record<string, unknown>) => ["deals", "list", filters] as const,
  deal: (id: number) => ["deals", "detail", id] as const,

  contacts: ["contacts"] as const,
  contactList: (filters: Record<string, unknown>) => ["contacts", "list", filters] as const,
  contact: (id: number) => ["contacts", "detail", id] as const,

  companies: ["companies"] as const,
  companyList: (filters: Record<string, unknown>) => ["companies", "list", filters] as const,

  activities: ["activities"] as const,
  activityList: (filters: Record<string, unknown>) => ["activities", "list", filters] as const,

  tasks: ["tasks"] as const,
  taskList: (filters: Record<string, unknown>) => ["tasks", "list", filters] as const,
  tasksOverdue: ["tasks", "overdue"] as const,
};

/** A 401 is handled by the axios interceptor, so retrying one is just noise. */
function retryUnlessAuthError(failureCount: number, error: unknown): boolean {
  const status = (error as { response?: { status?: number } }).response?.status;
  if (status === 401 || status === 403 || status === 404) return false;
  return failureCount < 2;
}

// --------------------------------------------------------------------------- //
// Auth + dashboard
// --------------------------------------------------------------------------- //

export async function fetchMe(): Promise<UserOut> {
  const { data } = await api.get<UserOut>("/auth/me");
  return data;
}

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const { data } = await api.get<DashboardSummary>("/dashboard/summary");
  return data;
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: queryKeys.dashboardSummary,
    queryFn: fetchDashboardSummary,
    // Dashboard numbers change as the user works elsewhere in the app, but not
    // second to second -- 30s keeps it fresh without hammering the API.
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: retryUnlessAuthError,
  });
}

// --------------------------------------------------------------------------- //
// Deals
// --------------------------------------------------------------------------- //

/*
 * The board loads every deal in one request.
 *
 * Fine while a freelancer's pipeline is in the hundreds, and it lets the column
 * headers total up from data already in hand instead of a second call to
 * /deals/pipeline-summary. It will NOT scale indefinitely: past a few thousand
 * deals this wants per-column pagination (GET /deals?stage=X with skip/limit)
 * or windowing inside each column. The backend caps limit at 500, so that is
 * the real ceiling here.
 */
export const BOARD_DEAL_LIMIT = 500;

export async function fetchBoardDeals(): Promise<DealOut[]> {
  const { data } = await api.get<DealOut[]>("/deals", {
    params: { limit: BOARD_DEAL_LIMIT },
  });
  return data;
}

export function useBoardDeals() {
  return useQuery({
    queryKey: queryKeys.dealBoard,
    queryFn: fetchBoardDeals,
    staleTime: 15_000,
    retry: retryUnlessAuthError,
  });
}

export function useDeal(id: number) {
  return useQuery({
    queryKey: queryKeys.deal(id),
    queryFn: async () => {
      const { data } = await api.get<DealOut>(`/deals/${id}`);
      return data;
    },
    enabled: Number.isFinite(id),
    retry: retryUnlessAuthError,
  });
}

export function useContactDeals(contactId: number) {
  const filters = { contact_id: contactId };
  return useQuery({
    queryKey: queryKeys.dealList(filters),
    queryFn: async () => {
      const { data } = await api.get<DealOut[]>("/deals", { params: filters });
      return data;
    },
    enabled: Number.isFinite(contactId),
    retry: retryUnlessAuthError,
  });
}

export interface DealCreateInput {
  title: string;
  value: string;
  contact_id: number;
  expected_close_date?: string | null;
}

export interface DealUpdateInput {
  title: string;
  value: string;
  probability: number | null;
  expected_close_date: string | null;
  contact_id: number;
  /** Only sent when the contact changed -- see DealEditDialog. */
  company_id?: number | null;
}

/**
 * Anything that changes a deal's value or stage moves the dashboard's numbers
 * too, so both trees are invalidated together.
 */
function invalidateDealTrees(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.deals });
  void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
}

export function useCreateDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DealCreateInput) => {
      const { data } = await api.post<DealOut>("/deals", input);
      return data;
    },
    onSuccess: () => invalidateDealTrees(queryClient),
  });
}

export function useUpdateDeal(dealId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DealUpdateInput) => {
      // DealUpdate sets extra="forbid", so only these keys may be sent -- and
      // never `stage`, which moves through PATCH /deals/{id}/stage alone.
      const { data } = await api.put<DealOut>(`/deals/${dealId}`, input);
      return data;
    },
    onSuccess: (deal) => {
      queryClient.setQueryData(queryKeys.deal(dealId), deal);
      invalidateDealTrees(queryClient);
      void queryClient.invalidateQueries({ queryKey: queryKeys.contacts });
    },
  });
}

export function useDeleteDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dealId: number) => {
      await api.delete(`/deals/${dealId}`);
    },
    onSuccess: () => {
      invalidateDealTrees(queryClient);
      // Deleting a deal nulls deal_id on its activities and tasks.
      void queryClient.invalidateQueries({ queryKey: queryKeys.activities });
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
    },
  });
}

export interface StageChangeInput {
  dealId: number;
  stage: DealStage;
}

/**
 * Optimistic stage change, used by the kanban board.
 *
 * The card must land in its new column the instant it is dropped; waiting for
 * the round trip would make the board feel broken. On failure the previous
 * board snapshot is restored and the caller surfaces a toast.
 */
export function useChangeDealStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ dealId, stage }: StageChangeInput) => {
      const { data } = await api.patch<DealOut>(`/deals/${dealId}/stage`, { stage });
      return data;
    },

    onMutate: async ({ dealId, stage }) => {
      // Stop an in-flight board refetch from overwriting the optimistic state.
      await queryClient.cancelQueries({ queryKey: queryKeys.dealBoard });
      const previous = queryClient.getQueryData<DealOut[]>(queryKeys.dealBoard);

      queryClient.setQueryData<DealOut[]>(queryKeys.dealBoard, (deals) =>
        deals?.map((deal) => (deal.id === dealId ? { ...deal, stage } : deal)),
      );

      return { previous };
    },

    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.dealBoard, context.previous);
      }
    },

    onSettled: () => {
      invalidateDealTrees(queryClient);
      // The backend auto-logs a "Deal moved from X to Y" activity.
      void queryClient.invalidateQueries({ queryKey: queryKeys.activities });
    },
  });
}

export function useReopenDeal(dealId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<DealOut>(`/deals/${dealId}/reopen`);
      return data;
    },
    onSuccess: (deal) => {
      queryClient.setQueryData(queryKeys.deal(dealId), deal);
      invalidateDealTrees(queryClient);
    },
  });
}

// --------------------------------------------------------------------------- //
// Contacts
// --------------------------------------------------------------------------- //

export interface ContactListParams {
  search?: string;
  skip?: number;
  limit?: number;
}

export function useContacts(params: ContactListParams) {
  return useQuery({
    queryKey: queryKeys.contactList(params as Record<string, unknown>),
    queryFn: async () => {
      const { data } = await api.get<ContactOut[]>("/contacts", { params });
      return data;
    },
    // Keeps the current page on screen while the next one loads, so paging and
    // typing in the search box don't flash a skeleton over and over.
    placeholderData: keepPreviousData,
    retry: retryUnlessAuthError,
  });
}

export function useContact(id: number) {
  return useQuery({
    queryKey: queryKeys.contact(id),
    queryFn: async () => {
      const { data } = await api.get<ContactOut>(`/contacts/${id}`);
      return data;
    },
    enabled: Number.isFinite(id),
    retry: retryUnlessAuthError,
  });
}

export interface ContactInput {
  name: string;
  email: string | null;
  phone: string | null;
  company_id: number | null;
  notes?: string | null;
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ContactInput) => {
      const { data } = await api.post<ContactOut>("/contacts", input);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.contacts });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useUpdateContact(contactId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ContactInput) => {
      const { data } = await api.put<ContactOut>(`/contacts/${contactId}`, input);
      return data;
    },
    onSuccess: (contact) => {
      queryClient.setQueryData(queryKeys.contact(contactId), contact);
      void queryClient.invalidateQueries({ queryKey: queryKeys.contacts });
      // Deals and activities embed the contact's name.
      void queryClient.invalidateQueries({ queryKey: queryKeys.deals });
      void queryClient.invalidateQueries({ queryKey: queryKeys.activities });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (contactId: number) => {
      await api.delete(`/contacts/${contactId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.contacts });
      // Deleting a contact cascades to its deals.
      void queryClient.invalidateQueries({ queryKey: queryKeys.deals });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

// --------------------------------------------------------------------------- //
// Companies
// --------------------------------------------------------------------------- //

export function useCompanySearch(search: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.companyList({ search }),
    queryFn: async () => {
      const { data } = await api.get<CompanyOut[]>("/companies", {
        params: { search: search || undefined, limit: 20 },
      });
      return data;
    },
    enabled,
    placeholderData: keepPreviousData,
    retry: retryUnlessAuthError,
  });
}

export function useCreateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data } = await api.post<CompanyOut>("/companies", { name });
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.companies });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

// --------------------------------------------------------------------------- //
// Contact search (for the deal form's picker)
// --------------------------------------------------------------------------- //

export function useContactSearch(search: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.contactList({ search, picker: true }),
    queryFn: async () => {
      const { data } = await api.get<ContactOut[]>("/contacts", {
        params: { search: search || undefined, limit: 20 },
      });
      return data;
    },
    enabled,
    placeholderData: keepPreviousData,
    retry: retryUnlessAuthError,
  });
}

// --------------------------------------------------------------------------- //
// Activities
// --------------------------------------------------------------------------- //

export interface ActivityFilters {
  deal_id?: number;
  contact_id?: number;
}

export function useActivities(filters: ActivityFilters) {
  return useQuery({
    queryKey: queryKeys.activityList(filters as Record<string, unknown>),
    queryFn: async () => {
      const { data } = await api.get<ActivityOut[]>("/activities", {
        params: { ...filters, limit: 100 },
      });
      return data;
    },
    enabled: Object.values(filters).some((value) => Number.isFinite(value)),
    retry: retryUnlessAuthError,
  });
}

export interface ActivityInput {
  type: string;
  content: string;
  occurred_at: string;
  contact_id: number;
  deal_id?: number | null;
}

export function useCreateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ActivityInput) => {
      const { data } = await api.post<ActivityOut>("/activities", input);
      return data;
    },
    onSuccess: () => {
      // Invalidates the whole activities tree, so an activity logged from the
      // deal page also refreshes the contact's timeline (and vice versa)
      // without either view needing to know the other exists.
      void queryClient.invalidateQueries({ queryKey: queryKeys.activities });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useDeleteActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (activityId: number) => {
      await api.delete(`/activities/${activityId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.activities });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

// --------------------------------------------------------------------------- //
// Tasks
// --------------------------------------------------------------------------- //

export function useContactTasks(contactId: number) {
  const filters = { contact_id: contactId };
  return useQuery({
    queryKey: queryKeys.taskList(filters),
    queryFn: async () => {
      const { data } = await api.get<TaskOut[]>("/tasks", { params: filters });
      return data;
    },
    enabled: Number.isFinite(contactId),
    retry: retryUnlessAuthError,
  });
}

export function useDealTasks(dealId: number) {
  const filters = { deal_id: dealId };
  return useQuery({
    queryKey: queryKeys.taskList(filters),
    queryFn: async () => {
      const { data } = await api.get<TaskOut[]>("/tasks", { params: filters });
      return data;
    },
    enabled: Number.isFinite(dealId),
    retry: retryUnlessAuthError,
  });
}

export function useTaskList(status: TaskStatus | "all") {
  const filters = status === "all" ? {} : { status };
  return useQuery({
    queryKey: queryKeys.taskList({ ...filters, scope: "page" }),
    queryFn: async () => {
      const { data } = await api.get<TaskOut[]>("/tasks", {
        params: { ...filters, limit: 200 },
      });
      return data;
    },
    placeholderData: keepPreviousData,
    retry: retryUnlessAuthError,
  });
}

/**
 * Overdue uses the backend's dedicated endpoint rather than filtering the
 * general list client-side: "overdue" is defined server-side as pending AND
 * due_date < now(), and re-deriving that in the browser would drift the moment
 * the two definitions disagree (or the list is paginated).
 */
export function useOverdueTasks(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.tasksOverdue,
    queryFn: async () => {
      const { data } = await api.get<TaskOut[]>("/tasks/overdue", {
        params: { limit: 200 },
      });
      return data;
    },
    enabled,
    placeholderData: keepPreviousData,
    retry: retryUnlessAuthError,
  });
}

export interface TaskCreateInput {
  title: string;
  description: string | null;
  due_date: string | null;
  contact_id: number | null;
  deal_id: number | null;
}

export interface TaskUpdateInput {
  title: string;
  description: string | null;
  due_date: string | null;
  contact_id: number | null;
  deal_id: number | null;
}

/**
 * Every task mutation invalidates the whole tasks tree plus the dashboard.
 *
 * That is what keeps the inline actions on the contact and deal pages in step
 * with the main /tasks list and the dashboard's overdue counter -- none of
 * those views needs to know the others exist.
 */
function invalidateTaskTrees(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
  void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TaskCreateInput) => {
      const { data } = await api.post<TaskOut>("/tasks", input);
      return data;
    },
    onSuccess: () => invalidateTaskTrees(queryClient),
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, input }: { taskId: number; input: TaskUpdateInput }) => {
      // TaskUpdate sets extra="forbid" and has no `status` field -- status only
      // moves through the complete/cancel endpoints.
      const { data } = await api.put<TaskOut>(`/tasks/${taskId}`, input);
      return data;
    },
    onSuccess: () => invalidateTaskTrees(queryClient),
  });
}

export function useCompleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: number) => {
      const { data } = await api.patch<TaskOut>(`/tasks/${taskId}/complete`);
      return data;
    },
    onSuccess: () => invalidateTaskTrees(queryClient),
  });
}

export function useCancelTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: number) => {
      const { data } = await api.patch<TaskOut>(`/tasks/${taskId}/cancel`);
      return data;
    },
    onSuccess: () => invalidateTaskTrees(queryClient),
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: number) => {
      await api.delete(`/tasks/${taskId}`);
    },
    onSuccess: () => invalidateTaskTrees(queryClient),
  });
}
