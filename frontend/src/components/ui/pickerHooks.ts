import { useCompanySearch, useContactSearch } from "@/api/hooks";

import type { SearchableOption } from "./SearchableSelect";

/**
 * Adapters turning the search endpoints into SearchableSelect's option shape.
 *
 * They live here rather than beside any one dialog because four screens now
 * pick a contact or a company: the new-deal form, the deal edit form, the
 * contact form, and the task form.
 */

export function useContactOptions(term: string, enabled: boolean) {
  const query = useContactSearch(term, enabled);
  return {
    data: query.data?.map<SearchableOption>((contact) => ({
      id: contact.id,
      label: contact.name,
      sublabel: contact.company?.name ?? contact.email ?? null,
    })),
    isFetching: query.isFetching,
  };
}

export function useCompanyOptions(term: string, enabled: boolean) {
  const query = useCompanySearch(term, enabled);
  return {
    data: query.data?.map<SearchableOption>((company) => ({
      id: company.id,
      label: company.name,
      sublabel: company.industry,
    })),
    isFetching: query.isFetching,
  };
}
