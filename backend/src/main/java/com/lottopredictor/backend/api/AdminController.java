package com.lottopredictor.backend.api;

import com.lottopredictor.backend.admin.AdminService;
import com.lottopredictor.backend.admin.AdminUserResponse;
import com.lottopredictor.backend.admin.SetTierRequest;
import com.lottopredictor.backend.auth.AuthPrincipal;
import com.lottopredictor.backend.auth.AuthenticatedUser;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminService adminService;
    private final Long adminUserId;

    public AdminController(AdminService adminService, @Value("${admin.user-id}") Long adminUserId) {
        this.adminService = adminService;
        this.adminUserId = adminUserId;
    }

    @GetMapping("/users")
    public ResponseEntity<List<AdminUserResponse>> listUsers(@AuthPrincipal AuthenticatedUser principal) {
        if (!adminUserId.equals(principal.userId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(adminService.listUsers());
    }

    @PostMapping("/users/{userId}/tier")
    public ResponseEntity<AdminUserResponse> setTier(
            @PathVariable Long userId,
            @RequestBody SetTierRequest request,
            @AuthPrincipal AuthenticatedUser principal
    ) {
        if (!adminUserId.equals(principal.userId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(adminService.setForcedTier(userId, request.tier()));
    }
}
