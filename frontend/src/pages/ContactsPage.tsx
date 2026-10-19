import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { getErrorMessage } from "@/api/client";
import { useContacts } from "@/api/hooks";
import { IconContacts } from "@/components/icons";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

const PAGE_SIZE = 25;

export function ContactsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const debouncedSearch = useDebouncedValue(search, 300);

  // A new search term means the old page number is meaningless.
  useEffect(() => setPage(0), [debouncedSearch]);

  /*
   * The API returns a bare array with no total count, so there is no way to
   * show "page 3 of 9". Asking for one row more than we display tells us
   * whether a next page exists, which is enough for prev/next controls.
   */
  const { data, isPending, isError, error, isFetching } = useContacts({
    search: debouncedSearch || undefined,
    skip: page * PAGE_SIZE,
    limit: PAGE_SIZE + 1,
  });

  const rows = data?.slice(0, PAGE_SIZE) ?? [];
  const hasNextPage = (data?.length ?? 0) > PAGE_SIZE;
  const firstRowNumber = page * PAGE_SIZE + 1;

  return (
    <>
      <PageHeader
        title="Contacts"
        description="Everyone you're tracking, and the companies they work for."
        action={
          <Button variant="primary" onClick={() => navigate("/contacts/new")}>
            New contact
          </Button>
        }
      />

      <Card>
        <div className="border-b border-ink-200 px-5 py-3.5">
          <label htmlFor="contact-search" className="sr-only">
            Search contacts
          </label>
          <div className="relative max-w-sm">
            <input
              id="contact-search"
              type="search"
              placeholder="Search by name or email..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={cn(
                "block w-full rounded-md border border-ink-300 bg-white py-2 pr-3 pl-9 text-sm",
                "text-ink-800 placeholder:text-ink-400 transition-colors duration-150",
                "focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30 focus:outline-none",
              )}
            />
            <svg
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              aria-hidden="true"
            >
              <circle cx="7" cy="7" r="4.5" />
              <path d="m10.5 10.5 3 3" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {isPending ? (
          <ContactsTableSkeleton />
        ) : isError ? (
          <div className="px-5 py-4">
            <Alert tone="danger" title="Couldn't load contacts">
              {getErrorMessage(error, "The request failed. Please try again.")}
            </Alert>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<IconContacts className="size-5" />}
            title={debouncedSearch ? "No contacts match that search" : "No contacts yet"}
            description={
              debouncedSearch
                ? `Nothing found for "${debouncedSearch}". Try a different name or email.`
                : "Add the people you work with and you'll be able to open deals and log activity against them."
            }
            action={
              debouncedSearch ? (
                <Button variant="secondary" onClick={() => setSearch("")}>
                  Clear search
                </Button>
              ) : (
                <Button variant="primary" onClick={() => navigate("/contacts/new")}>
                  New contact
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-ink-200">
                    {["Name", "Email", "Company", "Phone"].map((heading) => (
                      <th
                        key={heading}
                        scope="col"
                        className="px-5 py-2.5 text-[11px] font-semibold tracking-wide text-ink-500 uppercase"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className={cn("divide-y divide-ink-100", isFetching && "opacity-60")}>
                  {rows.map((contact) => (
                    <tr
                      key={contact.id}
                      onClick={() => navigate(`/contacts/${contact.id}`)}
                      className="cursor-pointer transition-colors hover:bg-ink-50"
                    >
                      <td className="px-5 py-3">
                        {/* The link is the real control -- it gives keyboard
                            users a tab stop and an actual href. The row click
                            is a mouse convenience layered on top. */}
                        <Link
                          to={`/contacts/${contact.id}`}
                          onClick={(event) => event.stopPropagation()}
                          className="text-[13px] font-medium text-ink-800 underline-offset-2 hover:underline"
                        >
                          {contact.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-[13px] text-ink-600">
                        {contact.email ?? <span className="text-ink-400">&mdash;</span>}
                      </td>
                      <td className="px-5 py-3 text-[13px] text-ink-600">
                        {contact.company?.name ?? <span className="text-ink-400">&mdash;</span>}
                      </td>
                      <td className="px-5 py-3 text-[13px] text-ink-600">
                        {contact.phone ?? <span className="text-ink-400">&mdash;</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {(page > 0 || hasNextPage) && (
              <div className="flex items-center justify-between gap-3 border-t border-ink-200 px-5 py-3">
                <p className="tabular text-[12px] text-ink-500">
                  Showing {firstRowNumber}&ndash;{firstRowNumber + rows.length - 1}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={page === 0 || isFetching}
                    onClick={() => setPage((current) => Math.max(0, current - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!hasNextPage || isFetching}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}

function ContactsTableSkeleton() {
  return (
    <div>
      <div className="flex gap-4 border-b border-ink-200 px-5 py-2.5">
        {[80, 120, 100, 90].map((width, index) => (
          <Skeleton key={index} className="h-2.5" style={{ width }} />
        ))}
      </div>
      <ul className="divide-y divide-ink-100">
        {Array.from({ length: 6 }, (_, index) => (
          <li key={index} className="flex items-center gap-4 px-5 py-3.5">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-52" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-28" />
          </li>
        ))}
      </ul>
    </div>
  );
}
