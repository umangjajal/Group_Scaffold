import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-purple-900 text-white overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-black/20 backdrop-blur z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="text-2xl font-bold">🎬 Realtime Group</div>
          <div className="space-x-4">
            {user ? (
              <>
                <Link
                  to="/groups"
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition"
                >
                  Dashboard
                </Link>
                <Link
                  to="/profile"
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition"
                >
                  Profile
                </Link>
                <Link
                  to="/admin-login"
                  className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition"
                >
                  Admin
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition"
                >
                  Sign Up
                </Link>
                <Link
                  to="/admin-login"
                  className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition"
                >
                  Admin
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="pt-20 pb-32 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center min-h-screen">
            {/* Left Content */}
            <div className="animate-slideInUp">
              <h1 className="text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                Connect & <span className="gradient-text">Collaborate</span> in Real Time
              </h1>
              <p className="text-xl text-blue-100 mb-8 leading-relaxed">
                Create private or public rooms, manage members, and communicate seamlessly with video, audio, and chat. 
                Perfect for teams, groups, and communities.
              </p>

              <div className="flex gap-4 mb-12">
                <Link
                  to={user ? "/groups" : "/signup"}
                  className="px-8 py-4 bg-white text-blue-600 rounded-lg font-bold text-lg hover:bg-blue-50 transition transform hover:scale-105"
                >
                  Get Started 🚀
                </Link>
                <button className="px-8 py-4 border-2 border-white text-white rounded-lg font-bold text-lg hover:bg-white/10 transition">
                  Learn More 📚
                </button>
              </div>

              {/* Features List */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">✅</span>
                  <span className="text-lg">Public and private room creation</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">✅</span>
                  <span className="text-lg">Real-time video & audio calls</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">✅</span>
                  <span className="text-lg">Instant messaging system</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">✅</span>
                  <span className="text-lg">Member management & admin panel</span>
                </div>
              </div>
            </div>

            {/* Right Illustration */}
            <div className="relative h-96 lg:h-full flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-500 rounded-3xl opacity-20 blur-3xl animate-pulse" />
              <div className="relative z-10 text-center">
                <div className="text-9xl mb-4 animate-float">🎥</div>
                <p className="text-2xl font-bold">Start Connecting Now</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-black/30 backdrop-blur py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center mb-16">✨ Why Choose Us?</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Feature 1 */}
            <div className="bg-white/10 backdrop-blur rounded-xl p-6 hover:bg-white/20 transition">
              <div className="text-4xl mb-4">🔐</div>
              <h3 className="text-xl font-bold mb-2">Secure</h3>
              <p className="text-blue-100">End-to-end encryption for all communications</p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white/10 backdrop-blur rounded-xl p-6 hover:bg-white/20 transition">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-bold mb-2">Fast</h3>
              <p className="text-blue-100">Low latency real-time communication</p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white/10 backdrop-blur rounded-xl p-6 hover:bg-white/20 transition">
              <div className="text-4xl mb-4">📱</div>
              <h3 className="text-xl font-bold mb-2">Works Everywhere</h3>
              <p className="text-blue-100">Desktop, tablet, and mobile friendly</p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white/10 backdrop-blur rounded-xl p-6 hover:bg-white/20 transition">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-xl font-bold mb-2">Easy to Use</h3>
              <p className="text-blue-100">Intuitive interface for everyone</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center mb-16">💰 Simple Pricing</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Free Plan */}
            <div className="bg-white/10 backdrop-blur rounded-xl p-8 border border-white/20">
              <h3 className="text-2xl font-bold mb-4">Free</h3>
              <div className="text-4xl font-bold mb-6">$0<span className="text-lg">/month</span></div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2">✅ 10 rooms</li>
                <li className="flex items-center gap-2">✅ 100 members per room</li>
                <li className="flex items-center gap-2">✅ Basic chat</li>
                <li className="flex items-center gap-2">✅ Video calls</li>
              </ul>
              <button className="w-full py-3 bg-white/20 hover:bg-white/30 rounded-lg font-bold transition">
                Get Started
              </button>
            </div>

            {/* Pro Plan */}
            <div className="bg-white/20 backdrop-blur rounded-xl p-8 border-2 border-white/40 transform scale-105">
              <div className="bg-blue-600 text-white px-4 py-2 rounded-full inline-block mb-4 font-bold">
                Popular ⭐
              </div>
              <h3 className="text-2xl font-bold mb-4">Pro</h3>
              <div className="text-4xl font-bold mb-6">$9<span className="text-lg">/month</span></div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2">✅ 50 rooms</li>
                <li className="flex items-center gap-2">✅ 1000 members per room</li>
                <li className="flex items-center gap-2">✅ Advanced chat</li>
                <li className="flex items-center gap-2">✅ HD video calls</li>
                <li className="flex items-center gap-2">✅ Screen sharing</li>
              </ul>
              <button className="w-full py-3 bg-white text-blue-600 rounded-lg font-bold hover:bg-blue-50 transition">
                Subscribe Now
              </button>
            </div>

            {/* Enterprise Plan */}
            <div className="bg-white/10 backdrop-blur rounded-xl p-8 border border-white/20">
              <h3 className="text-2xl font-bold mb-4">Enterprise</h3>
              <div className="text-4xl font-bold mb-6">Custom</div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2">✅ Unlimited rooms</li>
                <li className="flex items-center gap-2">✅ Unlimited members</li>
                <li className="flex items-center gap-2">✅ Private server</li>
                <li className="flex items-center gap-2">✅ 24/7 support</li>
              </ul>
              <button className="w-full py-3 bg-white/20 hover:bg-white/30 rounded-lg font-bold transition">
                Contact Sales
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Get Started?</h2>
          <p className="text-xl mb-8 text-blue-100">
            Join thousands of users connecting and collaborating in real time.
          </p>
          <Link
            to={user ? "/groups" : "/signup"}
            className="inline-block px-8 py-4 bg-white text-blue-600 rounded-lg font-bold text-lg hover:bg-blue-50 transition transform hover:scale-105"
          >
            Start For Free 🚀
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-black/50 backdrop-blur py-8 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="font-bold mb-4">Product</h4>
              <ul className="space-y-2 text-blue-100">
                <li><a href="#" className="hover:text-white">Features</a></li>
                <li><a href="#" className="hover:text-white">Pricing</a></li>
                <li><a href="#" className="hover:text-white">Security</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Company</h4>
              <ul className="space-y-2 text-blue-100">
                <li><a href="#" className="hover:text-white">About</a></li>
                <li><a href="#" className="hover:text-white">Blog</a></li>
                <li><a href="#" className="hover:text-white">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Resources</h4>
              <ul className="space-y-2 text-blue-100">
                <li><a href="#" className="hover:text-white">Documentation</a></li>
                <li><a href="#" className="hover:text-white">Support</a></li>
                <li><a href="#" className="hover:text-white">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Legal</h4>
              <ul className="space-y-2 text-blue-100">
                <li><a href="#" className="hover:text-white">Privacy</a></li>
                <li><a href="#" className="hover:text-white">Terms</a></li>
                <li><a href="#" className="hover:text-white">Cookies</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 text-center text-blue-100">
            <p>&copy; 2026 Realtime Group. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
