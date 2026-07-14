"use client";

import { Check, CircleDollarSign, HandCoins, LayoutDashboard, Menu, Plus, ReceiptText, Trash2, Users, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { requestGraphql } from "@/lib/graphql-client";

type Person = {
  id: string;
  name: string;
};

type ExpenseSession = {
  id: string;
  name: string;
  createdAt: string;
};

type Expense = {
  id: string;
  description: string;
  amountCents: number;
  paidBy: Person;
  createdAt: string;
  shares: Array<{ person: Person; amountCents: number }>;
};

type Balance = {
  person: Person;
  amountCents: number;
};

type Settlement = {
  from: Person;
  to: Person;
  amountCents: number;
};

type Dashboard = {
  people: Person[];
  expenses: Expense[];
  balances: Balance[];
  settlements: Settlement[];
};

type DashboardResponse = {
  dashboard: Dashboard;
};

type SessionsResponse = {
  sessions: ExpenseSession[];
};

type CreateSessionResponse = {
  createSession: ExpenseSession;
};

const sessionsQuery = /* GraphQL */ `
  query Sessions {
    sessions { id name createdAt }
  }
`;

const dashboardQuery = /* GraphQL */ `
  query Dashboard($sessionId: ID!) {
    dashboard(sessionId: $sessionId) {
      people { id name }
      expenses {
        id description amountCents createdAt
        paidBy { id name }
        shares { person { id name } amountCents }
      }
      balances { person { id name } amountCents }
      settlements { from { id name } to { id name } amountCents }
    }
  }
`;

const createSessionMutation = /* GraphQL */ `
  mutation CreateSession($name: String!) {
    createSession(name: $name) { id name createdAt }
  }
`;

const addPersonMutation = /* GraphQL */ `
  mutation AddPerson($sessionId: ID!, $name: String!) {
    addPerson(sessionId: $sessionId, name: $name) { id name }
  }
`;

const addExpenseMutation = /* GraphQL */ `
  mutation AddExpense($sessionId: ID!, $input: AddExpenseInput!) {
    addExpense(sessionId: $sessionId, input: $input) { id }
  }
`;

const deleteExpenseMutation = /* GraphQL */ `
  mutation DeleteExpense($sessionId: ID!, $id: ID!) {
    deleteExpense(sessionId: $sessionId, id: $id) { id }
  }
`;

export default function Home() {
  const router = useRouter();
  const pathname = usePathname();
  const [sessions, setSessions] = useState<ExpenseSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingPerson, setIsAddingPerson] = useState(false);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [personName, setPersonName] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [payerId, setPayerId] = useState("");
  const [participantIds, setParticipantIds] = useState<string[] | null>(null);
  const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false);
  const [isSessionSidebarOpen, setIsSessionSidebarOpen] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [sessionName, setSessionName] = useState("");

  async function refreshDashboard() {
    if (!selectedSessionId) {
      return;
    }
    const response = await requestGraphql<DashboardResponse>(dashboardQuery, {
      sessionId: selectedSessionId,
    });
    setDashboard(response.dashboard);
  }

  useEffect(() => {
    let isCurrent = true;

    void requestGraphql<SessionsResponse>(sessionsQuery)
      .then(async (response) => {
        const requestedSessionId = new URLSearchParams(window.location.search).get("session");
        const selectedSession = response.sessions.find(
          (session) => session.id === requestedSessionId,
        ) ?? response.sessions[0];

        if (isCurrent) {
          setSessions(response.sessions);
          setSelectedSessionId(selectedSession?.id ?? "");
        }

        if (selectedSession) {
          const dashboardResponse = await requestGraphql<DashboardResponse>(dashboardQuery, {
            sessionId: selectedSession.id,
          });
          if (isCurrent) {
            setDashboard(dashboardResponse.dashboard);
            if (requestedSessionId !== selectedSession.id) {
              router.replace(`${pathname}?session=${selectedSession.id}`);
            }
          }
        }
      })
      .catch((reason: unknown) => {
        if (isCurrent) {
          setError(errorMessage(reason));
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [pathname, router]);

  async function selectSession(sessionId: string) {
    setSelectedSessionId(sessionId);
    setDashboard(null);
    setPayerId("");
    setParticipantIds(null);
    setError(null);
    setIsLoading(true);
    router.push(`${pathname}?session=${sessionId}`);

    try {
      const response = await requestGraphql<DashboardResponse>(dashboardQuery, { sessionId });
      setDashboard(response.dashboard);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setIsLoading(false);
    }
  }

  async function createSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsCreatingSession(true);

    try {
      const response = await requestGraphql<CreateSessionResponse>(createSessionMutation, {
        name: sessionName,
      });
      setSessions((current) => [...current, response.createSession]);
      setSessionName("");
      setIsSessionDialogOpen(false);
      await selectSession(response.createSession.id);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setIsCreatingSession(false);
    }
  }

  async function addPerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSessionId) {
      return;
    }
    setError(null);
    setIsAddingPerson(true);

    try {
      await requestGraphql(addPersonMutation, {
        sessionId: selectedSessionId,
        name: personName,
      });
      setPersonName("");
      await refreshDashboard();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setIsAddingPerson(false);
    }
  }

  async function addExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSessionId) {
      return;
    }
    setError(null);

    let amountCents: number;
    try {
      amountCents = moneyToCents(amount);
    } catch (reason) {
      setError(errorMessage(reason));
      return;
    }

    setIsAddingExpense(true);
    try {
      await requestGraphql(addExpenseMutation, {
        sessionId: selectedSessionId,
        input: {
          description,
          amountCents,
          paidByPersonId: selectedPayerId,
          participantIds: selectedParticipantIds,
        },
      });
      setDescription("");
      setAmount("");
      await refreshDashboard();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setIsAddingExpense(false);
    }
  }

  async function deleteExpense(expenseId: string) {
    if (!selectedSessionId) {
      return;
    }
    setError(null);
    setDeletingExpenseId(expenseId);

    try {
      await requestGraphql(deleteExpenseMutation, {
        sessionId: selectedSessionId,
        id: expenseId,
      });
      await refreshDashboard();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setDeletingExpenseId(null);
    }
  }

  function toggleParticipant(personId: string) {
    setParticipantIds((current) => {
      const selected = current ?? people.map((person) => person.id);
      return selected.includes(personId)
        ? selected.filter((id) => id !== personId)
        : [...selected, personId];
    });
  }

  const people = dashboard?.people ?? [];
  const selectedParticipantIds = (participantIds ?? people.map((person) => person.id)).filter((id) =>
    people.some((person) => person.id === id),
  );
  const selectedPayerId = people.some((person) => person.id === payerId)
    ? payerId
    : (people[0]?.id ?? "");
  const canAddExpense = people.length > 0 && selectedParticipantIds.length > 0;
  const selectedSession = sessions.find((session) => session.id === selectedSessionId);

  return (
    <main className="min-h-screen bg-muted/40 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r bg-sidebar px-4 py-6 lg:flex">
        <SessionNavigation
          sessions={sessions}
          selectedSessionId={selectedSessionId}
          isLoading={isLoading}
          onCreateSession={() => setIsSessionDialogOpen(true)}
          onSelectSession={(sessionId) => void selectSession(sessionId)}
        />
      </aside>

      <Sheet open={isSessionSidebarOpen} onOpenChange={setIsSessionSidebarOpen}>
        <SheetContent className="p-4">
          <SheetTitle className="sr-only">Expense sessions</SheetTitle>
          <SessionNavigation
            sessions={sessions}
            selectedSessionId={selectedSessionId}
            isLoading={isLoading}
            onCreateSession={() => {
              setIsSessionSidebarOpen(false);
              setIsSessionDialogOpen(true);
            }}
            onSelectSession={(sessionId) => {
              setIsSessionSidebarOpen(false);
              void selectSession(sessionId);
            }}
            closeButton={(
              <SheetClose
                render={<Button type="button" variant="ghost" size="icon" />}
                aria-label="Close session sidebar"
              >
                <X />
              </SheetClose>
            )}
          />
        </SheetContent>
      </Sheet>

      <div className="min-w-0">
        <header className="border-b bg-background/95">
          <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Open session sidebar"
                onClick={() => setIsSessionSidebarOpen(true)}
              >
                <Menu />
              </Button>
              <LayoutDashboard className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
              <h1 className="truncate text-lg font-semibold tracking-tight">
                {selectedSession?.name ?? (isLoading ? "Loading session..." : "No session selected")}
              </h1>
            </div>
            <p className="hidden shrink-0 text-sm text-muted-foreground sm:block">All amounts are in RM</p>
          </div>
        </header>

        <Dialog open={isSessionDialogOpen} onOpenChange={setIsSessionDialogOpen}>
          <DialogContent>
            <DialogTitle className="text-lg font-semibold">Create expense session</DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-6 text-muted-foreground">
              Start a separate space for its own people, expenses, balances, and settlements.
            </DialogDescription>
            <form className="mt-5 space-y-5" onSubmit={createSession}>
              <label className="grid gap-1.5 text-sm font-medium">
                Session name
                <input
                  className={inputClassName}
                  value={sessionName}
                  onChange={(event) => setSessionName(event.target.value)}
                  placeholder="e.g. Bali Trip"
                  maxLength={100}
                  required
                  autoFocus
                />
              </label>
              <div className="flex justify-end gap-3">
                <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
                <Button type="submit" disabled={isCreatingSession}>
                  <Plus /> {isCreatingSession ? "Creating..." : "Create session"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {error ? (
            <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
              {error}
            </div>
          ) : null}

          {isLoading ? (
          <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Loading your group…</div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-xl border bg-card p-5 shadow-sm">
              <SectionTitle icon={<Users />} title="People" subtitle="Add everyone sharing expenses." />
              <form className="mt-5 flex gap-2" onSubmit={addPerson}>
                <input
                  className={inputClassName}
                  value={personName}
                  onChange={(event) => setPersonName(event.target.value)}
                  placeholder="e.g. Ali"
                  maxLength={100}
                  required
                  aria-label="Person name"
                />
                <Button type="submit" disabled={!selectedSessionId || isAddingPerson}>
                  <Plus /> {isAddingPerson ? "Adding" : "Add"}
                </Button>
              </form>
              <ul className="mt-5 divide-y rounded-lg border">
                {people.length ? people.map((person) => (
                  <li key={person.id} className="flex items-center gap-3 px-3 py-3 text-sm font-medium">
                    <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">
                      {initials(person.name)}
                    </span>
                    {person.name}
                  </li>
                )) : (
                  <li className="px-3 py-6 text-center text-sm text-muted-foreground">No people yet. Add the participants for this session to begin.</li>
                )}
              </ul>
            </section>

            <section className="rounded-xl border bg-card p-5 shadow-sm">
              <SectionTitle icon={<ReceiptText />} title="Add an expense" subtitle="Every expense is split equally among selected people." />
              <form className="mt-5 space-y-4" onSubmit={addExpense}>
                <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
                  <label className="grid gap-1.5 text-sm font-medium">
                    Description
                    <input className={inputClassName} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="e.g. Dinner" maxLength={200} required disabled={!people.length} />
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium">
                    Amount (RM)
                    <input className={inputClassName} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" inputMode="decimal" required disabled={!people.length} />
                  </label>
                </div>

                <label className="grid gap-1.5 text-sm font-medium">
                  Paid by
                  <select className={inputClassName} value={selectedPayerId} onChange={(event) => setPayerId(event.target.value)} disabled={!people.length}>
                    {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                  </select>
                </label>

                <fieldset className="grid gap-2">
                  <legend className="text-sm font-medium">Split between</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {people.map((person) => (
                      <label key={person.id} className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
                        <input type="checkbox" checked={selectedParticipantIds.includes(person.id)} onChange={() => toggleParticipant(person.id)} disabled={!people.length} />
                        {person.name}
                      </label>
                    ))}
                  </div>
                  {!people.length ? <p className="text-sm text-muted-foreground">Add at least one person before recording an expense.</p> : null}
                </fieldset>

                <Button type="submit" className="w-full" size="lg" disabled={!canAddExpense || isAddingExpense}>
                  <Plus /> {isAddingExpense ? "Saving expense…" : "Add expense"}
                </Button>
              </form>
            </section>

            <section className="rounded-xl border bg-card p-5 shadow-sm">
              <SectionTitle icon={<CircleDollarSign />} title="Balances" subtitle="Positive means they should receive money." />
              <div className="mt-5 space-y-3">
                {dashboard?.balances.length ? dashboard.balances.map((balance) => (
                  <div key={balance.person.id} className="flex items-center justify-between rounded-lg border px-3 py-3">
                    <span className="font-medium">{balance.person.name}</span>
                    <span className={balance.amountCents > 0 ? "font-semibold text-emerald-700" : balance.amountCents < 0 ? "font-semibold text-rose-700" : "font-semibold text-muted-foreground"}>
                      {balance.amountCents > 0 ? "+" : ""}{formatMoney(balance.amountCents)}
                    </span>
                  </div>
                )) : <EmptyState message="Balances will appear after your first expense." />}
              </div>
            </section>

            <section className="rounded-xl border bg-card p-5 shadow-sm">
              <SectionTitle icon={<HandCoins />} title="Settle up" subtitle="The fewest payments needed to clear all balances." />
              <div className="mt-5 space-y-3">
                {dashboard?.settlements.length ? dashboard.settlements.map((settlement, index) => (
                  <div key={`${settlement.from.id}-${settlement.to.id}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-3 text-sm">
                    <span><strong>{settlement.from.name}</strong> pays <strong>{settlement.to.name}</strong></span>
                    <span className="shrink-0 font-semibold">{formatMoney(settlement.amountCents)}</span>
                  </div>
                )) : <EmptyState icon={<Check className="size-4" />} message={dashboard?.expenses.length ? "Everyone is settled up." : "Settlement suggestions will appear after expenses are added."} />}
              </div>
            </section>

            <section className="rounded-xl border bg-card p-5 shadow-sm lg:col-span-2">
              <SectionTitle icon={<ReceiptText />} title="Expense history" subtitle="The history of each expense made." />
              <div className="mt-5 divide-y rounded-lg border">
                {dashboard?.expenses.length ? dashboard.expenses.map((expense) => (
                  <article key={expense.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-medium">{expense.description}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">Paid by {expense.paidBy.name} · Split between {expense.shares.map((share) => share.person.name).join(", ")}</p>
                    </div>
                    <div className="flex items-start gap-3 text-left sm:text-right">
                      <div>
                        <p className="font-semibold">{formatMoney(expense.amountCents)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{new Date(expense.createdAt).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}</p>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger
                          type="button"
                          className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Delete ${expense.description}`}
                        >
                          <Trash2 className="size-4" />
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogTitle className="text-lg font-semibold">Delete “{expense.description}”?</AlertDialogTitle>
                          <AlertDialogDescription className="mt-2 text-sm leading-6 text-muted-foreground">
                            This permanently removes the expense and its split details. Balances and settlement suggestions will be recalculated.
                          </AlertDialogDescription>
                          <div className="mt-6 flex justify-end gap-3">
                            <AlertDialogCancel disabled={deletingExpenseId === expense.id}>Cancel</AlertDialogCancel>
                            <Button
                              type="button"
                              variant="destructive"
                              disabled={deletingExpenseId === expense.id}
                              onClick={() => deleteExpense(expense.id)}
                            >
                              <Trash2 /> {deletingExpenseId === expense.id ? "Deleting…" : "Delete expense"}
                            </Button>
                          </div>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </article>
                )) : <EmptyState message="No expenses recorded yet." />}
              </div>
            </section>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function SessionNavigation({
  sessions,
  selectedSessionId,
  isLoading,
  onCreateSession,
  onSelectSession,
  closeButton,
}: {
  sessions: ExpenseSession[];
  selectedSessionId: string;
  isLoading: boolean;
  onCreateSession: () => void;
  onSelectSession: (sessionId: string) => void;
  closeButton?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start justify-between gap-3 px-1">
        <div>
          <p className="text-xl font-bold tracking-tight text-sidebar-foreground">SplitSmart</p>
          <p className="mt-1 text-xs text-muted-foreground">Shared expenses, simplified</p>
        </div>
        {closeButton}
      </div>

      <Button type="button" className="mt-7 w-full" size="lg" onClick={onCreateSession}>
        <Plus /> New session
      </Button>

      <nav className="mt-7 flex min-h-0 flex-1 flex-col" aria-label="Expense sessions">
        <p className="px-2 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Sessions
        </p>
        <div className="mt-2 min-h-0 space-y-1 overflow-y-auto">
          {sessions.length ? sessions.map((session) => {
            const isActive = session.id === selectedSessionId;
            return (
              <button
                key={session.id}
                type="button"
                className={[
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-sidebar-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                ].join(" ")}
                aria-current={isActive ? "page" : undefined}
                disabled={isLoading && !isActive}
                onClick={() => {
                  if (!isActive) {
                    onSelectSession(session.id);
                  }
                }}
              >
                <span
                  className={[
                    "flex size-5 shrink-0 items-center justify-center rounded-full border",
                    isActive ? "border-sidebar-primary-foreground/50" : "border-sidebar-border",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  <span className={isActive ? "size-1.5 rounded-full bg-sidebar-primary-foreground" : "size-1.5 rounded-full bg-muted-foreground/50"} />
                </span>
                <span className="truncate">{session.name}</span>
              </button>
            );
          }) : (
            <p className="px-3 py-3 text-sm leading-5 text-muted-foreground">
              Create a session to start splitting expenses.
            </p>
          )}
        </div>
      </nav>
    </div>
  );
}

function SectionTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-primary">{icon}</span>
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function EmptyState({ icon, message }: { icon?: React.ReactNode; message: string }) {
  return <p className="flex items-center justify-center gap-2 px-3 py-7 text-center text-sm text-muted-foreground">{icon}{message}</p>;
}

function moneyToCents(value: string): number {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) {
    throw new Error("Enter an amount such as 10 or 10.50.");
  }

  const wholeRinggit = Number(match[1]);
  const cents = Number((match[2] ?? "").padEnd(2, "0"));
  const amountCents = wholeRinggit * 100 + cents;

  if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > 2_147_483_647) {
    throw new Error("Enter an amount greater than zero.");
  }

  return amountCents;
}

function formatMoney(amountCents: number): string {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
  }).format(amountCents / 100);
}

function initials(name: string): string {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Something went wrong. Please try again.";
}

const inputClassName = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";
