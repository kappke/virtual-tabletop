package logging

import "time"

type Logger struct {
	ServiceName string
}

func NewLogger(serviceName string) *Logger {
	return &Logger{ServiceName: serviceName}
}

func (l *Logger) Info(message string) {
	now := time.Now().Format("2006-01-02 15:04:05")
	println(now, "INFO ["+l.ServiceName+"]", message)
}

func (l *Logger) Error(message string) {
	now := time.Now().Format("2006-01-02 15:04:05")
	println(now, "ERROR ["+l.ServiceName+"]", message)
}
