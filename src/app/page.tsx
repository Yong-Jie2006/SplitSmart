"use client";

import {
  ArrowRight,
  Check,
  CircleDollarSign,
  HandCoins,
  Menu,
  Plus,
  ReceiptText,
  Trash2,
  UserPlus,
  Users,
  WalletCards,
  X,
} from "lucide-react";
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
  const [isPeopleDialogOpen, setIsPeopleDialogOpen] = useState(false);
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);

  async function refreshDashboard() {
    if (!selectedSessionId) {
      return;
    }
    const response = await requestGraphql<DashboardResponse>(dashboardQuery, {
      sessionId: selectedSessionId,
    });
    setDashboard(response.dashboard);
  }

  async function refreshSessions() {
    const response = await requestGraphql<SessionsResponse>(sessionsQuery);
    setSessions(response.sessions);
  }

  async function refreshDashboardAndSessions() {
    await Promise.all([refreshDashboard(), refreshSessions()]);
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
    setIsPeopleDialogOpen(false);
    setIsExpenseDialogOpen(false);
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
      setSessions((current) => [
        response.createSession,
        ...current.filter((session) => session.id !== response.createSession.id),
      ]);
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
      await refreshDashboardAndSessions();
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
      setParticipantIds(null);
      setIsExpenseDialogOpen(false);
      await refreshDashboardAndSessions();
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
      await refreshDashboardAndSessions();
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

  function openPeopleDialog() {
    setError(null);
    setIsPeopleDialogOpen(true);
  }

  function openExpenseDialog() {
    setError(null);
    setIsExpenseDialogOpen(true);
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
  const totalSpentCents = dashboard?.expenses.reduce((total, expense) => total + expense.amountCents, 0) ?? 0;
  const unsettledCents = dashboard?.balances.reduce(
    (total, balance) => total + Math.max(balance.amountCents, 0),
    0,
  ) ?? 0;
  const previewAmountCents = parseMoneyOrNull(amount);
  const previewShares = previewAmountCents
    ? splitPreview(previewAmountCents, selectedParticipantIds, people)
    : [];

  return (
    <main className="min-h-screen bg-[#f7f8fa] lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
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
        <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-xl">
          <div className="mx-auto flex min-h-20 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
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
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold tracking-[-0.025em] sm:text-2xl">
                  {selectedSession?.name ?? (isLoading ? "Loading session..." : "No session selected")}
                </h1>
                <p className="mt-0.5 truncate text-xs text-muted-foreground sm:text-sm">
                  {people.length} {people.length === 1 ? "person" : "people"} · {dashboard?.expenses.length ?? 0} {dashboard?.expenses.length === 1 ? "expense" : "expenses"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <PeopleStack people={people} onClick={openPeopleDialog} />
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="size-9 p-0 sm:h-9 sm:w-auto sm:px-2.5"
                aria-label="Add person"
                disabled={!selectedSessionId}
                onClick={openPeopleDialog}
              >
                <UserPlus /> <span className="hidden sm:inline">Add person</span>
              </Button>
            </div>
          </div>
        </header>

        <Dialog open={isSessionDialogOpen} onOpenChange={setIsSessionDialogOpen}>
          <DialogContent>
            <DialogHeader
              title="Create expense session"
              description="Start a separate space for its own people, expenses, balances, and settlements."
            />
            {error ? <InlineError message={error} /> : null}
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

        <Dialog open={isPeopleDialogOpen} onOpenChange={setIsPeopleDialogOpen}>
          <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto">
            <DialogHeader
              title="People"
              description={`Everyone sharing expenses in ${selectedSession?.name ?? "this session"}.`}
            />
            {error ? <InlineError message={error} /> : null}

            <form className="mt-5 flex gap-2" onSubmit={addPerson}>
              <label className="sr-only" htmlFor="person-name">Person name</label>
              <input
                id="person-name"
                className={inputClassName}
                value={personName}
                onChange={(event) => setPersonName(event.target.value)}
                placeholder="Enter a name"
                maxLength={100}
                required
                autoFocus
              />
              <Button type="submit" size="lg" disabled={!selectedSessionId || isAddingPerson}>
                <Plus /> {isAddingPerson ? "Adding" : "Add"}
              </Button>
            </form>

            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">All people</p>
                <span className="text-xs text-muted-foreground">{people.length} total</span>
              </div>
              <ul className="divide-y rounded-xl border bg-muted/20">
                {people.length ? people.map((person) => (
                  <li key={person.id} className="flex items-center gap-3 px-4 py-3.5">
                    <Avatar person={person} />
                    <span className="text-sm font-medium">{person.name}</span>
                  </li>
                )) : (
                  <li className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No people yet. Add the participants for this session to begin.
                  </li>
                )}
              </ul>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
          <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto">
            <DialogHeader
              title="Add an expense"
              description="Record a purchase and choose exactly who should share it."
            />
            {error ? <InlineError message={error} /> : null}

            <form className="mt-6 space-y-5" onSubmit={addExpense}>
              <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
                <label className="grid gap-1.5 text-sm font-medium">
                  Description
                  <input
                    className={inputClassName}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="e.g. Dinner"
                    maxLength={200}
                    required
                    autoFocus
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Amount (RM)
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">RM</span>
                    <input
                      className={`${inputClassName} pl-10 font-medium tabular-nums`}
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      placeholder="0.00"
                      inputMode="decimal"
                      required
                    />
                  </div>
                </label>
              </div>

              <label className="grid gap-1.5 text-sm font-medium">
                Paid by
                <select
                  className={inputClassName}
                  value={selectedPayerId}
                  onChange={(event) => setPayerId(event.target.value)}
                >
                  {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                </select>
              </label>

              <fieldset className="grid gap-2.5">
                <div className="flex items-center justify-between gap-3">
                  <legend className="text-sm font-medium">Split between</legend>
                  <div className="flex gap-3 text-xs">
                    <button
                      type="button"
                      className="font-medium text-primary hover:underline"
                      onClick={() => setParticipantIds(people.map((person) => person.id))}
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      className="font-medium text-muted-foreground hover:text-foreground hover:underline"
                      onClick={() => setParticipantIds([])}
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {people.map((person) => {
                    const isSelected = selectedParticipantIds.includes(person.id);
                    return (
                      <label
                        key={person.id}
                        className={[
                          "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm transition-colors",
                          isSelected ? "border-primary/25 bg-primary/[0.04]" : "hover:bg-muted/60",
                        ].join(" ")}
                      >
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={isSelected}
                          onChange={() => toggleParticipant(person.id)}
                        />
                        <Avatar person={person} size="sm" />
                        <span className="font-medium">{person.name}</span>
                        {isSelected ? <Check className="ml-auto size-4 text-primary" /> : null}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {previewShares.length ? (
                <div className="rounded-xl border border-primary/10 bg-primary/[0.035] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">Equal split preview</p>
                    <p className="text-sm font-semibold tabular-nums">{formatMoney(previewAmountCents ?? 0)}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {previewShares.map((share) => (
                      <span key={share.person.id} className="rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground">
                        {share.person.name} <strong className="font-semibold text-foreground">{formatMoney(share.amountCents)}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
                <DialogClose render={<Button type="button" variant="outline" size="lg" />}>Cancel</DialogClose>
                <Button type="submit" size="lg" disabled={!canAddExpense || isAddingExpense}>
                  <Plus /> {isAddingExpense ? "Saving expense..." : "Save expense"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {error ? (
            <div className="mb-6 rounded-xl border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm text-destructive" role="alert">
              {error}
            </div>
          ) : null}

          {isLoading ? (
            <DashboardSkeleton />
          ) : (
            <>
              <section aria-label="Session summary" className="grid gap-3 sm:grid-cols-3 lg:gap-4">
                <SummaryCard
                  icon={<WalletCards />}
                  label="Total spent"
                  value={formatMoney(totalSpentCents)}
                  tone="indigo"
                />
                <SummaryCard
                  icon={<CircleDollarSign />}
                  label="Amount unsettled"
                  value={formatMoney(unsettledCents)}
                  tone="amber"
                />
                <SummaryCard
                  icon={<HandCoins />}
                  label="Payments needed"
                  value={`${dashboard?.settlements.length ?? 0} ${dashboard?.settlements.length === 1 ? "payment" : "payments"}`}
                  tone="blue"
                />
              </section>

              {!people.length ? (
                <section className="mt-6 rounded-2xl border border-dashed bg-card px-6 py-12 text-center shadow-sm">
                  <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary/8 text-primary">
                    <Users className="size-5" />
                  </span>
                  <h2 className="mt-4 text-lg font-semibold">Add your group to get started</h2>
                  <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                    Add the people sharing expenses. Then you can record purchases and SplitSmart will calculate the balances.
                  </p>
                  <Button type="button" size="lg" className="mt-5" onClick={openPeopleDialog}>
                    <UserPlus /> Add first person
                  </Button>
                  <p className="mt-4 text-sm text-muted-foreground">No people yet. Add the participants for this session to begin.</p>
                </section>
              ) : (
                <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.85fr)]">
                  <section className="overflow-hidden rounded-2xl border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                    <SectionHeading
                      title="Recent expenses"
                      subtitle="Every shared purchase in this session."
                      action={(
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                            {dashboard?.expenses.length ?? 0} total
                          </span>
                          <Button type="button" size="sm" onClick={openExpenseDialog}>
                            <Plus /> Add expense
                          </Button>
                        </div>
                      )}
                    />
                    <div className="border-t">
                      {dashboard?.expenses.length ? dashboard.expenses.map((expense) => (
                        <article
                          key={expense.id}
                          className="group flex items-start gap-3 border-b px-4 py-4 last:border-b-0 hover:bg-muted/25 sm:items-center sm:px-5"
                        >
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                            <ReceiptText className="size-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-sm font-semibold">{expense.description}</h3>
                            <p className="mt-1 truncate text-xs text-muted-foreground sm:text-sm">
                              Paid by {expense.paidBy.name} · {expense.shares.length} {expense.shares.length === 1 ? "person" : "people"} · {formatDate(expense.createdAt)}
                            </p>
                          </div>
                          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
                            <p className="text-sm font-semibold tabular-nums sm:text-base">{formatMoney(expense.amountCents)}</p>
                            <AlertDialog>
                              <AlertDialogTrigger
                                type="button"
                                className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-70 transition-all hover:bg-destructive/10 hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
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
                                    <Trash2 /> {deletingExpenseId === expense.id ? "Deleting..." : "Delete expense"}
                                  </Button>
                                </div>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </article>
                      )) : (
                        <EmptyState
                          icon={<ReceiptText className="size-5" />}
                          title="No expenses recorded yet."
                          message="Add the first expense to start calculating balances."
                          action={(
                            <Button type="button" onClick={openExpenseDialog}>
                              <Plus /> Add first expense
                            </Button>
                          )}
                        />
                      )}
                    </div>
                  </section>

                  <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-1">
                    <section className="overflow-hidden rounded-2xl border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                      <SectionHeading
                        title="Balances"
                        subtitle="Who owes and who gets money back."
                      />
                      <div className="divide-y border-t">
                        {dashboard?.balances.length ? dashboard.balances.map((balance) => {
                          const status = balance.amountCents > 0
                            ? "gets back"
                            : balance.amountCents < 0
                              ? "owes"
                              : "settled";
                          return (
                            <div key={balance.person.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                              <Avatar person={balance.person} />
                              <span className="min-w-0 flex-1 truncate text-sm font-medium">{balance.person.name}</span>
                              <div className="text-right">
                                <p className={[
                                  "text-xs font-medium",
                                  balance.amountCents > 0
                                    ? "text-emerald-700"
                                    : balance.amountCents < 0
                                      ? "text-rose-600"
                                      : "text-muted-foreground",
                                ].join(" ")}>{status}</p>
                                <p className={[
                                  "mt-0.5 text-sm font-semibold tabular-nums",
                                  balance.amountCents > 0
                                    ? "text-emerald-700"
                                    : balance.amountCents < 0
                                      ? "text-rose-600"
                                      : "text-muted-foreground",
                                ].join(" ")}>
                                  {balance.amountCents > 0 ? "+" : balance.amountCents < 0 ? "-" : ""}{formatMoney(Math.abs(balance.amountCents))}
                                </p>
                              </div>
                            </div>
                          );
                        }) : (
                          <EmptyState title="No balances yet" message="Balances appear after your first expense." />
                        )}
                      </div>
                    </section>

                    <section className="overflow-hidden rounded-2xl border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                      <SectionHeading
                        title="Settle up"
                        subtitle="The fewest payments to clear every balance."
                      />
                      <div className="divide-y border-t">
                        {dashboard?.settlements.length ? dashboard.settlements.map((settlement, index) => (
                          <div
                            key={`${settlement.from.id}-${settlement.to.id}-${index}`}
                            className="flex items-center gap-2 px-4 py-4 sm:px-5"
                            aria-label={`${settlement.from.name} pays ${settlement.to.name}`}
                          >
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              <Avatar person={settlement.from} size="sm" />
                              <span className="truncate text-sm font-medium">{settlement.from.name}</span>
                              <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                              <Avatar person={settlement.to} size="sm" />
                              <span className="truncate text-sm font-medium">{settlement.to.name}</span>
                              <span className="sr-only">{settlement.from.name} pays {settlement.to.name}</span>
                            </div>
                            <span className="shrink-0 text-sm font-semibold tabular-nums">{formatMoney(settlement.amountCents)}</span>
                          </div>
                        )) : (
                          <EmptyState
                            icon={<Check className="size-5" />}
                            title={dashboard?.expenses.length ? "Everyone is settled up" : "Nothing to settle yet"}
                            message={dashboard?.expenses.length
                              ? "No payments are needed right now."
                              : "Suggestions appear after expenses are added."}
                          />
                        )}
                      </div>
                    </section>
                  </div>
                </div>
              )}
            </>
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

function DialogHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-start justify-between gap-4 pr-1">
      <div>
        <DialogTitle className="text-xl font-semibold tracking-tight">{title}</DialogTitle>
        <DialogDescription className="mt-1.5 text-sm leading-6 text-muted-foreground">
          {description}
        </DialogDescription>
      </div>
      <DialogClose
        render={<Button type="button" variant="ghost" size="icon" />}
        aria-label={`Close ${title.toLowerCase()}`}
      >
        <X />
      </DialogClose>
    </div>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <p className="mt-4 rounded-lg border border-destructive/20 bg-destructive/8 px-3 py-2 text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}

function PeopleStack({ people, onClick }: { people: Person[]; onClick: () => void }) {
  return (
    <button
      type="button"
      className="hidden items-center rounded-full p-1 outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 md:flex"
      aria-label={`View and manage ${people.length} ${people.length === 1 ? "person" : "people"}`}
      onClick={onClick}
    >
      {people.length ? (
        <>
          <span className="flex -space-x-2">
            {people.slice(0, 4).map((person) => (
              <Avatar key={person.id} person={person} className="ring-2 ring-background" />
            ))}
          </span>
          {people.length > 4 ? (
            <span className="-ml-1 flex size-8 items-center justify-center rounded-full border bg-muted text-[0.6875rem] font-semibold text-muted-foreground ring-2 ring-background">
              +{people.length - 4}
            </span>
          ) : null}
        </>
      ) : (
        <span className="flex size-8 items-center justify-center rounded-full border bg-muted text-muted-foreground">
          <Users className="size-4" />
        </span>
      )}
    </button>
  );
}

function Avatar({
  person,
  size = "md",
  className = "",
}: {
  person: Person;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={[
        "flex shrink-0 items-center justify-center rounded-full border font-semibold",
        size === "sm" ? "size-7 text-[0.625rem]" : "size-8 text-[0.6875rem]",
        avatarClassName(person.name),
        className,
      ].join(" ")}
      aria-hidden="true"
    >
      {initials(person.name)}
    </span>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "indigo" | "amber" | "blue";
}) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
  };

  return (
    <article className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-5">
      <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl [&_svg]:size-5 ${tones[tone]}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-muted-foreground sm:text-sm">{label}</p>
        <p className="mt-1 truncate text-lg font-semibold tracking-[-0.02em] tabular-nums sm:text-xl">{value}</p>
      </div>
    </article>
  );
}

function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-4 sm:px-5 sm:py-5">
      <div>
        <h2 className="font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-5 py-10 text-center">
      {icon ? (
        <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          {icon}
        </span>
      ) : null}
      <p className={`${icon ? "mt-3" : ""} text-sm font-medium`}>{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-muted-foreground">{message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse" aria-label="Loading dashboard">
      <div className="grid gap-3 sm:grid-cols-3 lg:gap-4">
        {[0, 1, 2].map((item) => <div key={item} className="h-24 rounded-2xl border bg-card" />)}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.85fr)]">
        <div className="h-96 rounded-2xl border bg-card" />
        <div className="grid gap-6">
          <div className="h-64 rounded-2xl border bg-card" />
          <div className="h-56 rounded-2xl border bg-card" />
        </div>
      </div>
    </div>
  );
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

function parseMoneyOrNull(value: string): number | null {
  try {
    return moneyToCents(value);
  } catch {
    return null;
  }
}

function splitPreview(amountCents: number, participantIds: string[], people: Person[]) {
  const participants = participantIds
    .map((personId) => people.find((person) => person.id === personId))
    .filter((person): person is Person => Boolean(person));
  if (!participants.length) {
    return [];
  }

  const baseShare = Math.floor(amountCents / participants.length);
  const remainder = amountCents % participants.length;
  return participants.map((person, index) => ({
    person,
    amountCents: baseShare + (index < remainder ? 1 : 0),
  }));
}

function formatMoney(amountCents: number): string {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
  }).format(amountCents / 100);
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function initials(name: string): string {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function avatarClassName(name: string): string {
  const palette = [
    "border-indigo-100 bg-indigo-50 text-indigo-700",
    "border-emerald-100 bg-emerald-50 text-emerald-700",
    "border-amber-100 bg-amber-50 text-amber-700",
    "border-rose-100 bg-rose-50 text-rose-700",
    "border-sky-100 bg-sky-50 text-sky-700",
  ];
  const value = Array.from(name).reduce((total, character) => total + character.charCodeAt(0), 0);
  return palette[value % palette.length];
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Something went wrong. Please try again.";
}

const inputClassName = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50";
