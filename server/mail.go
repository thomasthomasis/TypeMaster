package main

import (
	"errors"
	"net"
	"net/smtp"
)

func sendMail(to, subject, body string) error {
	if cfg.SMTPHost == "" {
		return errors.New("SMTP_HOST is not configured")
	}
	var auth smtp.Auth
	if cfg.SMTPUser != "" {
		auth = smtp.PlainAuth("", cfg.SMTPUser, cfg.SMTPPass, cfg.SMTPHost)
	}
	msg := "From: TypeMaster <" + cfg.SMTPFrom + ">\r\n" +
		"To: " + to + "\r\n" +
		"Subject: " + subject + "\r\n" +
		"MIME-Version: 1.0\r\n" +
		"Content-Type: text/plain; charset=UTF-8\r\n\r\n" +
		body
	addr := net.JoinHostPort(cfg.SMTPHost, cfg.SMTPPort)
	return smtp.SendMail(addr, auth, cfg.SMTPFrom, []string{to}, []byte(msg))
}

func sendVerificationEmail(to, code string) error {
	return sendMail(to, "Verify your TypeMaster email",
		"Your verification code is: "+code+"\n\nIt expires in 15 minutes.")
}

func sendPasswordResetEmail(to, code string) error {
	return sendMail(to, "Reset your TypeMaster password",
		"Your password reset code is: "+code+"\n\nIt expires in 15 minutes. "+
			"If you didn't ask for this, you can ignore this email.")
}