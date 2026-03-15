<?php
namespace App\Http\Controllers;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller{

    public function showDashboard(){
        return view('dashboard');
    }//showDashboard

    public function showRegister(){
        return view('users.register');
    }//showRegister
    public function register(Request $request){
        $data = $request->validate([
            'username' => 'required',
            'email' => 'required|email|unique:users,email',
            'password' => 'required',
        ]);
        $user = User::create($data);
        return redirect()->route('users.login')->with('success', 'User registered successfully, please login');
    }//register

    public function showLogin(){
        return view('users.login');
    }//showLogin
    public function login(Request $request){
        $data = $request->validate([
            'username' => 'required',
            'password' => 'required',
        ]);
        $user = User::where('username', $data['username'])->first();
        if (!$user) {
            return redirect()->route('users.login')->with('error', 'Invalid username');
        }
        elseif (!Hash::check($data['password'], $user->password)) {
            return redirect()->route('users.login')->with('error', 'Invalid password');
        }
        return redirect()->route('users.dashboard')->with('success', 'Logged in successfully');
    }//login

    public function showLogout(){
        return view('users.logout');
    }//showLogout
    public function logout(Request $request){
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return redirect()->route('users.login')->with('success', 'Logged out successfully');
    }//logout
}
