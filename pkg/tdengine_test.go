package main

import (
	"testing"
	"time"

	"github.com/araddon/dateparse"
	"github.com/stretchr/testify/assert"
)

type dateTest struct {
	in, out string
	err     bool
}

func TestParseLayout(t *testing.T) {

	time.Local = time.UTC
	var testParseFormat = []dateTest{
		{in: "2009-08-12T22:15Z", out: "2006-01-02T15:04Z"},
		{in: "2006-01-02T15:04:05.000Z", out: "2006-01-02T15:04:05.000Z"},
		{in: "2006-01-02T15:04:05.000000Z", out: "2006-01-02T15:04:05.000000Z"},
		{in: "2006-01-02T15:04:05.000000000Z", out: "2006-01-02T15:04:05.000000000Z"},

		{in: "2009-08-12T22:15:09+08:00", out: "2006-01-02T15:04:05-07:00"},
		{in: "2009-08-12T22:15:09.123-07:00", out: "2006-01-02T15:04:05.000-07:00"},
		{in: "2009-08-12T22:15:09.123456-07:00", out: "2006-01-02T15:04:05.000000-07:00"},
		{in: "2009-08-12T22:15:09.123456789-07:00", out: "2006-01-02T15:04:05.000000000-07:00"},

		{in: "2009-08-12T22:15:09-0700", out: "2006-01-02T15:04:05-0700"},
		{in: "2009-08-12T22:15:09.123-0700", out: "2006-01-02T15:04:05.000-0700"},
		{in: "2009-08-12T22:15:09.123456-0700", out: "2006-01-02T15:04:05.000000-0700"},
		{in: "2009-08-12T22:15:09.123456789-0700", out: "2006-01-02T15:04:05.000000000-0700"},
	}

	for _, th := range testParseFormat {
		l, err := dateparse.ParseFormat(th.in)
		if th.err {
			assert.NotEqual(t, nil, err)
		} else {
			assert.Equal(t, nil, err)
			assert.Equal(t, th.out, l, "for in=%v", th.in)
		}
	}
}
