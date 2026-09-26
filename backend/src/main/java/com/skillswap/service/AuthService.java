package com.skillswap.service;

import com.skillswap.dto.auth.AuthResponse;
import com.skillswap.dto.auth.LoginRequest;
import com.skillswap.dto.auth.RefreshRequest;
import com.skillswap.dto.auth.SignupRequest;

public interface AuthService {

    AuthResponse signup(SignupRequest request);

    AuthResponse login(LoginRequest request);

    AuthResponse refresh(RefreshRequest request);
}
