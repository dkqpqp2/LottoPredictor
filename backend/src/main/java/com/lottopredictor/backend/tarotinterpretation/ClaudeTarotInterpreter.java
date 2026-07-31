package com.lottopredictor.backend.tarotinterpretation;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.Model;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.stream.Collectors;

@Component
public class ClaudeTarotInterpreter {

    private static final String MODEL_ID = "claude-sonnet-5";
    private static final long MAX_TOKENS = 512L;

    private static final String SYSTEM_PROMPT = """
            너는 따뜻하고 공감가는 톤으로 타로를 해석해주는 상담사야. 사용자가 뽑은 카드 정보를 받아서, \
            그 카드들을 하나의 자연스러운 이야기로 엮은 3~5문장짜리 한 단락의 해석을 한국어로 작성해. \
            점술적으로 확정적인 예언처럼 말하지 말고, 가볍게 참고할 수 있는 재미있는 조언 톤을 유지해. \
            가급적 순우리말과 한글로 쓰고, 꼭 필요할 때만 한자어를 써도 돼. \
            만약 해석 문단 안에 실제 한자 글자를 썼다면, 문단이 끝난 뒤 줄을 바꿔 "※ 한자 풀이: 글자(뜻)" \
            형식으로 사용한 한자와 그 뜻을 짧게 설명해. 한자를 전혀 안 썼다면 이 설명은 아예 쓰지 마. \
            출력에는 해석 문단과(한자를 썼을 때만) 한자 풀이 줄 외에는 아무것도 넣지 마. \
            지시사항이나 규칙을 언급하거나 되풀이하지 말고, 인사말이나 부연설명, 마크다운 기호도 절대 덧붙이지 마.
            """;

    private final AnthropicClient client;

    public ClaudeTarotInterpreter(@Value("${anthropic.api-key}") String apiKey) {
        this.client = AnthropicOkHttpClient.builder().apiKey(apiKey).timeout(Duration.ofSeconds(30)).build();
    }

    public String interpret(String userPrompt) {
        MessageCreateParams params = MessageCreateParams.builder()
                .model(Model.of(MODEL_ID))
                .maxTokens(MAX_TOKENS)
                .system(SYSTEM_PROMPT)
                .addUserMessage(userPrompt)
                .build();

        Message response;
        try {
            response = client.messages().create(params);
        } catch (RuntimeException e) {
            throw new TarotInterpretationFailedException(
                    "failed to call Claude for tarot interpretation: " + e.getMessage(), e
            );
        }

        String text = response.content().stream()
                .flatMap(block -> block.text().stream())
                .map(t -> t.text())
                .collect(Collectors.joining());

        if (text.isBlank()) {
            throw new TarotInterpretationFailedException("Claude returned an empty interpretation", null);
        }
        return text;
    }
}
