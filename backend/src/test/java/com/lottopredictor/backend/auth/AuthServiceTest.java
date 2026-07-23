package com.lottopredictor.backend.auth;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Test
    void createsANewUserWhenTheKakaoIdIsNotSeenBefore() {
        when(userRepository.findByKakaoId(123L)).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AuthService service = new AuthService(userRepository);
        User result = service.loginOrRegister(new KakaoUserInfo(123L, "홍길동"));

        assertThat(result.getKakaoId()).isEqualTo(123L);
        assertThat(result.getNickname()).isEqualTo("홍길동");
    }

    @Test
    void reusesTheExistingUserAndUpdatesTheNicknameOnRepeatLogin() {
        User existing = new User(123L, "옛날닉네임");
        when(userRepository.findByKakaoId(123L)).thenReturn(Optional.of(existing));
        when(userRepository.save(existing)).thenReturn(existing);

        AuthService service = new AuthService(userRepository);
        User result = service.loginOrRegister(new KakaoUserInfo(123L, "새닉네임"));

        assertThat(result).isSameAs(existing);
        assertThat(result.getNickname()).isEqualTo("새닉네임");
        verify(userRepository).save(existing);
    }
}
