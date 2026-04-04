import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "degenex.db");
const db = new Database(dbPath);

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT,
    balance REAL DEFAULT 1000,
    portfolio TEXT DEFAULT '{}',
    trades TEXT DEFAULT '[]',
    hasCompletedOnboarding INTEGER DEFAULT 0,
    isPro INTEGER DEFAULT 0,
    referralCode TEXT,
    referralsCount INTEGER DEFAULT 0,
    completedTasks TEXT DEFAULT '[]',
    lastLogin TEXT
  )
`);

export interface User {
  id: number;
  username?: string;
  balance: number;
  portfolio: { [tokenId: string]: number };
  trades: any[];
  hasCompletedOnboarding: boolean;
  isPro: boolean;
  referralCode: string;
  referralsCount: number;
  completedTasks: string[];
  lastLogin: string;
}

export const getUserByTelegramId = (id: number): User | null => {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
  if (!row) return null;
  
  return {
    ...row,
    portfolio: JSON.parse(row.portfolio),
    trades: JSON.parse(row.trades),
    completedTasks: JSON.parse(row.completedTasks),
    hasCompletedOnboarding: Boolean(row.hasCompletedOnboarding),
    isPro: Boolean(row.isPro),
  };
};

export const createUser = (id: number, username?: string): User => {
  const referralCode = `DGX-${id}`;
  const lastLogin = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO users (id, username, referralCode, lastLogin)
    VALUES (?, ?, ?, ?)
  `).run(id, username || null, referralCode, lastLogin);
  
  return {
    id,
    username,
    balance: 1000,
    portfolio: {},
    trades: [],
    hasCompletedOnboarding: false,
    isPro: false,
    referralCode,
    referralsCount: 0,
    completedTasks: [],
    lastLogin,
  };
};

export const updateUser = (user: User) => {
  db.prepare(`
    UPDATE users SET
      balance = ?,
      portfolio = ?,
      trades = ?,
      hasCompletedOnboarding = ?,
      isPro = ?,
      referralsCount = ?,
      completedTasks = ?,
      lastLogin = ?
    WHERE id = ?
  `).run(
    user.balance,
    JSON.stringify(user.portfolio),
    JSON.stringify(user.trades),
    user.hasCompletedOnboarding ? 1 : 0,
    user.isPro ? 1 : 0,
    user.referralsCount,
    JSON.stringify(user.completedTasks),
    user.lastLogin,
    user.id
  );
};

export const getAllUsers = (): User[] => {
  const rows = db.prepare("SELECT * FROM users").all() as any[];
  return rows.map(row => ({
    ...row,
    portfolio: JSON.parse(row.portfolio),
    trades: JSON.parse(row.trades),
    completedTasks: JSON.parse(row.completedTasks),
    hasCompletedOnboarding: Boolean(row.hasCompletedOnboarding),
    isPro: Boolean(row.isPro),
  }));
};
