import {
  AccountsIcon,
  BillsIcon,
  BudgetIcon,
  CreditCardIcon,
  IncomeIcon,
  ReportsIcon,
  ShoppingBagIcon,
  SubscriptionIcon,
  TagIcon,
  TransactionsIcon,
  WalletIcon,
} from "@/components/shared/icons";
import type { CategoryTone } from "@/types/orcamentos";

export function CategoryIcon({ categoryId, tone }: { categoryId: string; tone: CategoryTone }) {
  const className = `budget-category-icon ${tone}`;

  switch (categoryId) {
    case "alimentacao":
    case "compras":
      return <span className={className}><ShoppingBagIcon /></span>;
    case "moradia":
      return <span className={className}><AccountsIcon /></span>;
    case "transporte":
      return <span className={className}><TransactionsIcon /></span>;
    case "saude":
      return <span className={className}><BudgetIcon /></span>;
    case "assinaturas":
      return <span className={className}><SubscriptionIcon /></span>;
    case "contas-residenciais":
      return <span className={className}><BillsIcon /></span>;
    case "cartao-de-credito":
      return <span className={className}><CreditCardIcon /></span>;
    case "servicos":
    case "vendas":
      return <span className={className}><IncomeIcon /></span>;
    case "rendimentos":
      return <span className={className}><ReportsIcon /></span>;
    case "reembolso":
      return <span className={className}><WalletIcon /></span>;
    default:
      return <span className={className}><TagIcon /></span>;
  }
}
