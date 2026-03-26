<?php
namespace App\Http\Controllers;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;

class UserController extends Controller{

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
        Auth::login($user);
        return redirect()->route('dashboard')->with('success', 'Your account has been created successfully.');
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
            return redirect()->route('users.login')->with('error', 'Invalid username')->withInput();
        }
        elseif (!Hash::check($data['password'], $user->password)) {
            return redirect()->route('users.login')->with('error', 'Invalid password')->withInput();
        }
        Auth::login($user);
        $user->last_login_at = Carbon::now();
        $user->last_login_ip = $request->ip();
        $user->user_agent = $request->header('User-Agent');
        $user->save();
        return redirect()->route('dashboard')->with('success', 'Logged in successfully');
    }//login

    public function showProfile(){
        return view('users.profile');
    }//showProfile

    public function showLogout(){
        return view('users.logout');
    }//showLogout
    public function logout(Request $request){
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return redirect()->route('users.login')->with('success', 'Logged out successfully');
    }//logout
}
