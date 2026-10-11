import React, { useState } from "react";
import Layout from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import JournalEntriesTab from "@/components/accounting/JournalEntriesTab";
import FinancialStatementsTab from "@/components/accounting/FinancialStatementsTab";
import TrialBalanceTab from "@/components/accounting/TrialBalanceTab";
import CashFlowTab from "@/components/accounting/CashFlowTab";
import ChartOfAccountsTab from "@/components/accounting/ChartOfAccountsTab";
import AIValidationTab from "@/components/accounting/AIValidationTab";
import BankReconciliationTab from "@/components/accounting/BankReconciliationTab";
import AuditTrailTab from "@/components/accounting/AuditTrailTab";
import { BookOpen, Sparkles, Landmark, ScrollText } from "lucide-react";

export default function Accounting() {
  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold gold-text tracking-tight">Accounting</h1>
        <p className="text-muted-foreground mt-1">
          Manage chart of accounts, journal entries, and view financial statements
        </p>
      </div>

      <Tabs defaultValue="coa" className="w-full">
        <TabsList className="mb-6 flex flex-wrap h-auto">
          <TabsTrigger value="coa">
            <BookOpen className="w-4 h-4 mr-2" />
            Chart of Accounts
          </TabsTrigger>
          <TabsTrigger value="journal">
            Journal Entries
          </TabsTrigger>
          <TabsTrigger value="trial-balance">
            Trial Balance
          </TabsTrigger>
          <TabsTrigger value="statements">
            Financial Statements
          </TabsTrigger>
          <TabsTrigger value="cash-flow">
            Cash Flow
          </TabsTrigger>
          <TabsTrigger value="reconciliation">
            <Landmark className="w-4 h-4 mr-2" />
            Bank Reconciliation
          </TabsTrigger>
          <TabsTrigger value="ai-validation">
            <Sparkles className="w-4 h-4 mr-2" />
            AI Validation
          </TabsTrigger>
          <TabsTrigger value="audit-trail">
            <ScrollText className="w-4 h-4 mr-2" />
            Audit Trail
          </TabsTrigger>
        </TabsList>
        <TabsContent value="coa">
          <ChartOfAccountsTab />
        </TabsContent>
        <TabsContent value="journal">
          <JournalEntriesTab />
        </TabsContent>
        <TabsContent value="trial-balance">
          <TrialBalanceTab />
        </TabsContent>
        <TabsContent value="statements">
          <FinancialStatementsTab />
        </TabsContent>
        <TabsContent value="cash-flow">
          <CashFlowTab />
        </TabsContent>
        <TabsContent value="reconciliation">
          <BankReconciliationTab />
        </TabsContent>
        <TabsContent value="ai-validation">
          <AIValidationTab />
        </TabsContent>
        <TabsContent value="audit-trail">
          <AuditTrailTab />
        </TabsContent>
      </Tabs>
    </Layout>
  );
}