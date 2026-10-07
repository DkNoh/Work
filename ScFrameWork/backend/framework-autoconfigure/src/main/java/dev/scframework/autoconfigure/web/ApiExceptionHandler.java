package dev.scframework.autoconfigure.web;

import dev.scframework.core.ApiError;
import dev.scframework.core.ApiException;
import dev.scframework.core.FieldViolation;
import dev.scframework.autoconfigure.audit.RequestAuditRecorder;
import jakarta.persistence.OptimisticLockException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

@RestControllerAdvice
public class ApiExceptionHandler {
    private final RequestAuditRecorder audit;

    public ApiExceptionHandler() { this(null); }
    public ApiExceptionHandler(RequestAuditRecorder audit) { this.audit = audit; }

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiError> apiException(ApiException exception, HttpServletRequest request) {
        record(request, exception.status(), exception.error().code());
        return ResponseEntity.status(exception.status()).body(exception.error());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> validation(MethodArgumentNotValidException exception, HttpServletRequest request) {
        List<FieldViolation> errors = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> new FieldViolation(error.getField(), error.getDefaultMessage())).toList();
        return invalid(errors, request);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiError> constraint(ConstraintViolationException exception, HttpServletRequest request) {
        return invalid(exception.getConstraintViolations().stream().map(violation -> {
            String path = violation.getPropertyPath().toString();
            return new FieldViolation(path.substring(path.lastIndexOf('.') + 1), violation.getMessage());
        }).toList(), request);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiError> typeMismatch(MethodArgumentTypeMismatchException exception, HttpServletRequest request) {
        return invalid(List.of(new FieldViolation(exception.getName(), "값의 형식이 올바르지 않습니다.")), request);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> unreadable(HttpServletRequest request) {
        return invalid(List.of(), request);
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<ApiError> methodValidation(HandlerMethodValidationException exception, HttpServletRequest request) {
        if (exception.isForReturnValue()) return error(500, "INTERNAL_ERROR", "요청 처리 중 오류가 발생했습니다.", request);
        return invalid(List.of(), request);
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiError> missingParameter(MissingServletRequestParameterException exception,
            HttpServletRequest request) {
        return invalid(List.of(new FieldViolation(exception.getParameterName(), "필수 값입니다.")), request);
    }

    @ExceptionHandler({OptimisticLockingFailureException.class, OptimisticLockException.class})
    public ResponseEntity<ApiError> optimistic(HttpServletRequest request) {
        return error(409, "REVISION_CONFLICT", "다른 변경을 확인하고 다시 저장해 주세요.", request);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiError> dataConflict(HttpServletRequest request) {
        return error(409, "DATA_CONFLICT", "참조 자료나 중복 자료를 확인해 주세요.", request);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiError> denied(HttpServletRequest request) {
        return error(403, "FORBIDDEN", "요청 권한이 없습니다.", request);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiError> notFound(HttpServletRequest request) {
        return error(404, "NOT_FOUND", "요청한 자료를 찾을 수 없습니다.", request);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiError> methodNotAllowed(HttpServletRequest request) {
        return error(405, "METHOD_NOT_ALLOWED", "지원하지 않는 요청 방식입니다.", request);
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ApiError> mediaType(HttpServletRequest request) {
        return error(415, "UNSUPPORTED_MEDIA_TYPE", "지원하지 않는 자료 형식입니다.", request);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> unexpected(HttpServletRequest request) {
        return error(500, "INTERNAL_ERROR", "요청 처리 중 오류가 발생했습니다.", request);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiError> uploadTooLarge(HttpServletRequest request) {
        return error(413, "FILE_TOO_LARGE", "파일 또는 요청 크기 제한을 넘었습니다.", request);
    }

    @ExceptionHandler(MissingServletRequestPartException.class)
    public ResponseEntity<ApiError> missingPart(MissingServletRequestPartException exception, HttpServletRequest request) {
        return invalid(List.of(new FieldViolation(exception.getRequestPartName(), "파일을 선택해 주세요.")), request);
    }

    @ExceptionHandler(MultipartException.class)
    public ResponseEntity<ApiError> multipart(HttpServletRequest request) {
        return error(400, "INVALID_INPUT", "파일 요청 형식을 확인해 주세요.", request);
    }

    private ResponseEntity<ApiError> invalid(List<FieldViolation> errors, HttpServletRequest request) {
        record(request, 400, "INVALID_INPUT");
        return ResponseEntity.badRequest().body(new ApiError("INVALID_INPUT", "입력값을 확인해 주세요.", errors));
    }

    private ResponseEntity<ApiError> error(int status, String code, String message, HttpServletRequest request) {
        record(request, status, code);
        return ResponseEntity.status(status).body(ApiError.of(code, message));
    }

    private void record(HttpServletRequest request, int status, String code) {
        if (audit != null) audit.record(request, SecurityContextHolder.getContext().getAuthentication(),
                null, "HTTP_ERROR", status == 401 || status == 403 ? "DENIED" : "FAILURE", code);
    }
}
