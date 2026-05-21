import { query } from "@/lib/db";
import { revalidatePath } from "next/cache";
import Link from "next/link";

// Server-side initialization action to ensure Neon schema tables exist
async function ensureDatabaseSchema() {
  'use server';
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        creator_id VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        is_published BOOLEAN DEFAULT FALSE,
        price_cents INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS lessons (
        id SERIAL PRIMARY KEY,
        course_id INT REFERENCES courses(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        content_json JSONB DEFAULT '{}',
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS course_enrollments (
        id SERIAL PRIMARY KEY,
        student_id VARCHAR(255) NOT NULL,
        course_id INT REFERENCES courses(id) ON DELETE CASCADE,
        stripe_customer_id VARCHAR(255),
        stripe_subscription_id VARCHAR(255),
        completed_lessons JSONB DEFAULT '[]',
        enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (err) {
    console.error("Error creating database schema tables:", err);
  }
}

// Action to generate new course content directly inside the Neon instance
async function addSampleCourseAction() {
  'use server';
  try {
    await ensureDatabaseSchema();
    await query(`
      INSERT INTO courses (creator_id, title, description, is_published, price_cents)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      'creator_' + Math.floor(Math.random() * 1000), 
      'Mastering Twitter Threads to Micro-Courses', 
      'Learn the systematic pipeline to transform short-form thought leadership social hooks into monetizable premium text-and-JSON educational assets.', 
      true, 
      2900
    ]);
    revalidatePath('/');
  } catch (error) {
    console.error('Error running sample data insertion:', error);
  }
}

export default async function Home({ searchParams }: { searchParams: Promise<{ view?: string; authTab?: string }> }) {
  const params = await searchParams;
  const currentView = params.view || 'landing'; 
  const currentAuthTab = params.authTab || 'signin';

  // Attempt database synchronization prior to initial rendering layout
  await ensureDatabaseSchema();

  let courses: any[] = [];
  let dbError = false;
  try {
    const result = await query('SELECT * FROM courses ORDER BY created_at DESC');
    courses = result.rows;
  } catch (error) {
    console.error('Failed to read live table state:', error);
    dbError = true;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-500 selection:text-white">
      {/* Dynamic Header Block */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/?view=landing" className="flex items-center gap-2 font-bold text-xl tracking-tight text-slate-900">
            <span className="bg-indigo-600 text-white w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm shadow-sm">μ</span>
            <span>Course<span className="text-indigo-600 font-medium">Builder</span></span>
          </Link>
          
          <div className="flex items-center gap-4">
            {currentView === 'dashboard' ? (
              <Link href="/?view=landing" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition">
                Sign Out
              </Link>
            ) : (
              <>
                <Link href="/?view=auth&authTab=signin" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition">
                  Sign In
                </Link>
                <Link href="/?view=auth&authTab=signup" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Render Perspective View: Landing Page */}
      {currentView === 'landing' && (
        <div className="relative isolate overflow-hidden">
          <div className="mx-auto max-w-7xl px-6 pt-20 pb-24 text-center sm:pt-28 lg:px-8">
            <div className="mx-auto max-w-3xl">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-700/10 mb-6 animate-fade-in">
                Next.js + Neon Serverless SQL Stack
              </span>
              <h1 className="text-5xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
                Turn audience content into <span className="text-indigo-600 bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent">interactive micro-courses</span>
              </h1>
              <p className="mt-6 text-lg leading-8 text-slate-600 max-w-2xl mx-auto">
                Repurpose your blog posts, technical essays, or social threads into structured modular learning systems. Complete with rich-text builders, JSON progress tracking, and Stripe monetizations.
              </p>
              <div className="mt-10 flex items-center justify-center gap-x-6">
                <Link href="/?view=auth&authTab=signup" className="rounded-xl bg-slate-900 px-5 py-3 text-base font-semibold text-white shadow-md hover:bg-slate-800 transition">
                  Build a Course Free
                </Link>
                <Link href="/?view=dashboard" className="text-base font-semibold leading-6 text-slate-900 hover:text-indigo-600 transition flex items-center gap-1">
                  View Live Creator Sandbox →
                </Link>
              </div>
            </div>

            {/* Feature Highlights Grid */}
            <div className="mx-auto mt-24 max-w-5xl sm:mt-32">
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-left shadow-sm">
                  <div className="font-bold text-lg text-slate-900 mb-2">Drag-and-Drop Structure</div>
                  <p className="text-sm text-slate-600 leading-relaxed">Arrange lesson paths quickly. Store flexible rich layouts seamlessly using Postgres JSONB schemas.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-left shadow-sm">
                  <div className="font-bold text-lg text-slate-900 mb-2">Stripe Access Control</div>
                  <p className="text-sm text-slate-600 leading-relaxed">Gate premium tiers safely. Block unauthorized requests natively inside scalable serverless edge routing.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-left shadow-sm">
                  <div className="font-bold text-lg text-slate-900 mb-2">Neon Serverless Scale</div>
                  <p className="text-sm text-slate-600 leading-relaxed">Instant bottomless connections that autoscale down to absolute zero when traffic is low.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Render Perspective View: Dual-Tab Authentication Block */}
      {currentView === 'auth' && (
        <div className="flex flex-col items-center justify-center pt-20 pb-24 px-6">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
            {/* Navigational Tabs Control */}
            <div className="flex border-b border-slate-100 mb-8 p-1 bg-slate-100 rounded-xl">
              <Link 
                href="/?view=auth&authTab=signin" 
                className={`flex-1 text-center py-2 text-sm font-semibold rounded-lg transition-all ${currentAuthTab === 'signin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Sign In
              </Link>
              <Link 
                href="/?view=auth&authTab=signup" 
                className={`flex-1 text-center py-2 text-sm font-semibold rounded-lg transition-all ${currentAuthTab === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Create Account
              </Link>
            </div>

            <h2 className="text-2xl font-bold tracking-tight text-slate-900 text-center mb-2">
              {currentAuthTab === 'signin' ? 'Welcome back' : 'Start your creator engine'}
            </h2>
            <p className="text-xs text-slate-500 text-center mb-6">
              {currentAuthTab === 'signin' ? 'Log into your administrator backend profile' : 'Set up parameters to start monetizing writing fragments'}
            </p>

           <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-1">Email Address</label>
                <input type="email" placeholder="name@domain.com" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-1">Password</label>
                <input type="password" placeholder="••••••••" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition" />
              </div>
              
              <Link href="/?view=dashboard" className="w-full mt-2 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-500 transition">
                {currentAuthTab === 'signin' ? 'Access Workspace Account' : 'Generate New Workspace'}
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Render Perspective View: Database Course Dashboard Workspace */}
      {currentView === 'dashboard' && (
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-8 mb-10 gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Creator Hub Dashboard</h1>
              <p className="text-sm text-slate-500 mt-1">Live inspection point connected to Neon Serverless Instance</p>
            </div>
            <form action={addSampleCourseAction}>
              <button type="submit" className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-500 transition">
                + Seed Live Course
              </button>
            </form>
          </div>

          {dbError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-6 text-rose-800">
              <h3 className="font-bold mb-1 text-base">Neon Data Processing Connection Fault</h3>
              <p className="text-sm text-rose-700">Unable to accurately verify data matrices. Verify your system environment keys in `.env.local` are complete.</p>
            </div>
          ) : courses.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-16 text-center">
              <div className="mx-auto w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 font-bold text-xl mb-4">ø</div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">No operational courses instantiated</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">Your connection string is live and tables are verified! Click the seed button above to transmit record metrics via server-side operational tunnels.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course: any) => (
                <div key={course.id} className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
                        {course.is_published ? 'Published' : 'Draft'}
                      </span>
                      <span className="text-lg font-black text-slate-900">${(course.price_cents / 100).toFixed(2)}</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 line-clamp-1 mb-2">{course.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed line-clamp-3 mb-6">{course.description}</p>
                  </div>
                  <div className="border-t border-slate-100 pt-4 flex items-center justify-between text-xs text-slate-400">
                    <span>ID: {course.id}</span>
                    <span>Creator: {course.creator_id}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}