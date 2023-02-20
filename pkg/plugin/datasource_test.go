package plugin

import (
	"encoding/json"
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

func TestFormatData(t *testing.T) {
	d := `
{
    "code": 0,
    "column_meta": [
        ["voltage", "INT", 4],
        ["ts", "TIMESTAMP", 8],
        ["location", "VARCHAR", 64],
        ["groupid", "INT", 4]
    ],
    "data": [
        [100, "2023-02-02T08:00:00.000Z", "California.SanJose", 1],
        [108, "2023-02-02T08:00:01.000Z", "California.SanJose", 1],
        [108, "2023-02-02T08:00:02.000Z", "California.SanJose", 1],
        [105, "2023-02-02T08:00:03.000Z", "California.SanJose", 1],
        [null, "2023-02-02T08:00:04.000Z", "California.SanJose", 1],
        [109, "2023-02-02T08:00:05.000Z", "California.SanJose", 1],
        [105, "2023-02-02T08:00:06.000Z", "California.SanJose", 1],
        [101, "2023-02-02T08:00:07.000Z", "California.SanJose", 1],
        [null, "2023-02-02T08:00:08.000Z", "California.SanJose", 1],
        [108, "2023-02-02T08:00:09.000Z", "California.SanJose", 1],
        [107, "2023-02-02T08:00:10.000Z", "California.SanJose", 1],
        [105, "2023-02-02T08:00:00.000Z", "California.SanDiego", 1],
        [106, "2023-02-02T08:00:01.000Z", "California.SanDiego", 1],
        [100, "2023-02-02T08:00:02.000Z", "California.SanDiego", 1],
        [107, "2023-02-02T08:00:03.000Z", "California.SanDiego", 1],
        [109, "2023-02-02T08:00:04.000Z", "California.SanDiego", 1],
        [null, "2023-02-02T08:00:05.000Z", "California.SanDiego", 1],
        [102, "2023-02-02T08:00:06.000Z", "California.SanDiego", 1],
        [null, "2023-02-02T08:00:07.000Z", "California.SanDiego", 1],
        [109, "2023-02-02T08:00:08.000Z", "California.SanDiego", 1],
        [105, "2023-02-02T08:00:09.000Z", "California.SanDiego", 1],
        [101, "2023-02-02T08:00:10.000Z", "California.SanDiego", 1],
        [null, "2023-02-02T08:00:00.000Z", "California.Cupertino", 1],
        [null, "2023-02-02T08:00:01.000Z", "California.Cupertino", 1],
        [null, "2023-02-02T08:00:02.000Z", "California.Cupertino", 1],
        [null, "2023-02-02T08:00:03.000Z", "California.Cupertino", 1],
        [null, "2023-02-02T08:00:04.000Z", "California.Cupertino", 1],
        [null, "2023-02-02T08:00:05.000Z", "California.Cupertino", 1],
        [106, "2023-02-02T08:00:06.000Z", "California.Cupertino", 1],
        [105, "2023-02-02T08:00:07.000Z", "California.Cupertino", 1],
        [109, "2023-02-02T08:00:08.000Z", "California.Cupertino", 1],
        [null, "2023-02-02T08:00:09.000Z", "California.Cupertino", 1],
        [102, "2023-02-02T08:00:10.000Z", "California.Cupertino", 1],
        [null, "2023-02-02T08:00:00.000Z", "California.PaloAlto", 1],
        [107, "2023-02-02T08:00:01.000Z", "California.PaloAlto", 1],
        [108, "2023-02-02T08:00:02.000Z", "California.PaloAlto", 1],
        [100, "2023-02-02T08:00:03.000Z", "California.PaloAlto", 1],
        [null, "2023-02-02T08:00:04.000Z", "California.PaloAlto", 1],
        [null, "2023-02-02T08:00:05.000Z", "California.PaloAlto", 1],
        [null, "2023-02-02T08:00:06.000Z", "California.PaloAlto", 1],
        [108, "2023-02-02T08:00:07.000Z", "California.PaloAlto", 1],
        [108, "2023-02-02T08:00:08.000Z", "California.PaloAlto", 1],
        [108, "2023-02-02T08:00:09.000Z", "California.PaloAlto", 1],
        [109, "2023-02-02T08:00:10.000Z", "California.PaloAlto", 1],
        [109, "2023-02-02T08:00:00.000Z", "California.LosAngles", 1],
        [null, "2023-02-02T08:00:01.000Z", "California.LosAngles", 1],
        [108, "2023-02-02T08:00:02.000Z", "California.LosAngles", 1],
        [109, "2023-02-02T08:00:03.000Z", "California.LosAngles", 1],
        [null, "2023-02-02T08:00:04.000Z", "California.LosAngles", 1],
        [105, "2023-02-02T08:00:05.000Z", "California.LosAngles", 1],
        [109, "2023-02-02T08:00:06.000Z", "California.LosAngles", 1],
        [106, "2023-02-02T08:00:07.000Z", "California.LosAngles", 1],
        [105, "2023-02-02T08:00:08.000Z", "California.LosAngles", 1],
        [109, "2023-02-02T08:00:09.000Z", "California.LosAngles", 1],
        [105, "2023-02-02T08:00:10.000Z", "California.LosAngles", 1],
        [102, "2023-02-02T08:00:00.000Z", "California.MountainView", 1],
        [null, "2023-02-02T08:00:01.000Z", "California.MountainView", 1],
        [null, "2023-02-02T08:00:02.000Z", "California.MountainView", 1],
        [109, "2023-02-02T08:00:03.000Z", "California.MountainView", 1],
        [null, "2023-02-02T08:00:04.000Z", "California.MountainView", 1],
        [null, "2023-02-02T08:00:05.000Z", "California.MountainView", 1],
        [null, "2023-02-02T08:00:06.000Z", "California.MountainView", 1],
        [null, "2023-02-02T08:00:07.000Z", "California.MountainView", 1],
        [109, "2023-02-02T08:00:08.000Z", "California.MountainView", 1],
        [null, "2023-02-02T08:00:09.000Z", "California.MountainView", 1],
        [null, "2023-02-02T08:00:10.000Z", "California.MountainView", 1],
        [null, "2023-02-02T08:00:00.000Z", "California.Campbell", 1],
        [105, "2023-02-02T08:00:01.000Z", "California.Campbell", 1],
        [103, "2023-02-02T08:00:02.000Z", "California.Campbell", 1],
        [null, "2023-02-02T08:00:03.000Z", "California.Campbell", 1],
        [108, "2023-02-02T08:00:04.000Z", "California.Campbell", 1],
        [null, "2023-02-02T08:00:05.000Z", "California.Campbell", 1],
        [107, "2023-02-02T08:00:06.000Z", "California.Campbell", 1],
        [104, "2023-02-02T08:00:07.000Z", "California.Campbell", 1],
        [null, "2023-02-02T08:00:08.000Z", "California.Campbell", 1],
        [104, "2023-02-02T08:00:09.000Z", "California.Campbell", 1],
        [null, "2023-02-02T08:00:10.000Z", "California.Campbell", 1],
        [108, "2023-02-02T08:00:00.000Z", "California.Sunnyvale", 1],
        [null, "2023-02-02T08:00:01.000Z", "California.Sunnyvale", 1],
        [100, "2023-02-02T08:00:02.000Z", "California.Sunnyvale", 1],
        [106, "2023-02-02T08:00:03.000Z", "California.Sunnyvale", 1],
        [103, "2023-02-02T08:00:04.000Z", "California.Sunnyvale", 1],
        [106, "2023-02-02T08:00:05.000Z", "California.Sunnyvale", 1],
        [106, "2023-02-02T08:00:06.000Z", "California.Sunnyvale", 1],
        [108, "2023-02-02T08:00:07.000Z", "California.Sunnyvale", 1],
        [null, "2023-02-02T08:00:08.000Z", "California.Sunnyvale", 1],
        [null, "2023-02-02T08:00:09.000Z", "California.Sunnyvale", 1],
        [104, "2023-02-02T08:00:10.000Z", "California.Sunnyvale", 1],
        [null, "2023-02-02T08:00:00.000Z", "California.SanFrancisco", 1],
        [null, "2023-02-02T08:00:01.000Z", "California.SanFrancisco", 1],
        [105, "2023-02-02T08:00:02.000Z", "California.SanFrancisco", 1],
        [109, "2023-02-02T08:00:03.000Z", "California.SanFrancisco", 1],
        [102, "2023-02-02T08:00:04.000Z", "California.SanFrancisco", 1],
        [107, "2023-02-02T08:00:05.000Z", "California.SanFrancisco", 1],
        [100, "2023-02-02T08:00:06.000Z", "California.SanFrancisco", 1],
        [108, "2023-02-02T08:00:07.000Z", "California.SanFrancisco", 1],
        [108, "2023-02-02T08:00:08.000Z", "California.SanFrancisco", 1],
        [103, "2023-02-02T08:00:09.000Z", "California.SanFrancisco", 1],
        [null, "2023-02-02T08:00:10.000Z", "California.SanFrancisco", 1],
        [101, "2023-02-02T08:00:00.000Z", "California.SantaClara", 1],
        [109, "2023-02-02T08:00:01.000Z", "California.SantaClara", 1],
        [null, "2023-02-02T08:00:02.000Z", "California.SantaClara", 1],
        [null, "2023-02-02T08:00:03.000Z", "California.SantaClara", 1],
        [null, "2023-02-02T08:00:04.000Z", "California.SantaClara", 1],
        [102, "2023-02-02T08:00:05.000Z", "California.SantaClara", 1],
        [null, "2023-02-02T08:00:06.000Z", "California.SantaClara", 1],
        [null, "2023-02-02T08:00:07.000Z", "California.SantaClara", 1],
        [null, "2023-02-02T08:00:08.000Z", "California.SantaClara", 1],
        [null, "2023-02-02T08:00:09.000Z", "California.SantaClara", 1],
        [104, "2023-02-02T08:00:10.000Z", "California.SantaClara", 1]
    ],
    "rows": 110
}
`
	ds := Datasource{}
	var res dataResult
	model := queryModel{
		ColNameFormatStr: "voltage_{{location}}_{{groupid}}",
		ColNameToGroup:   "location, groupid",
		Hide:             false,
		IntervalMs:       0,
		MaxDataPoints:    0,
		Sql: "select _wstart as ts, max(voltage) as voltage, location, groupid from power.meters " +
			"where ts>='2023-02-02T08:00:00' and ts <= '2023-02-02T08:00:10' " +
			"partition by location, groupid interval(1s) fill(null)",
	}
	_ = json.Unmarshal([]byte(d), &res)
	err := ds.formatData(&res, &model, true)
	if err != nil {
		t.Fatal(err)
	}
	if res.Rows != 11 {
		t.Fatal("fail")
	}
	if len(res.ColumnMeta) != len(res.Data[0]) {
		t.Fatal("fail")
	}
}
